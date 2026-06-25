// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const gameDetailTTL = 7 * 24 * time.Hour

type CachedGame struct {
	IGDBID      int
	Name        string
	CoverURL    string // empty string means no cover
	Genres      []string
	ReleaseYear *int
	ReleaseDate *time.Time
	Category    *int
}

// GetGame returns a cached game by IGDB ID.
// Returns an error if the game is not in the cache — the caller should ensure
// the game is cached via the IGDB search endpoint before calling confirm.
func GetGame(ctx context.Context, pool *pgxpool.Pool, igdbID int) (CachedGame, error) {
	var g CachedGame
	var coverURL *string
	err := pool.QueryRow(ctx, `
		SELECT igdb_id, name, cover_url, genres, release_year, release_date, category
		FROM igdb_games
		WHERE igdb_id = $1
	`, igdbID).Scan(&g.IGDBID, &g.Name, &coverURL, &g.Genres, &g.ReleaseYear, &g.ReleaseDate, &g.Category)
	if err == pgx.ErrNoRows {
		return CachedGame{}, fmt.Errorf("game not in cache: %d", igdbID)
	}
	if err != nil {
		return CachedGame{}, err
	}
	if coverURL != nil {
		g.CoverURL = *coverURL
	}
	return g, nil
}

// CachedGameDetail holds the on-demand detail fields fetched from IGDB.
type CachedGameDetail struct {
	IGDBID           int
	Slug             string
	Summary          *string
	Screenshots      []string
	Platforms        []string
	Developer        *string
	Publisher        *string
	TrailerID        *string
	StoreLinks       map[string]string // key: "steam"|"epic"|"playstation"|"xbox"|"gog"|"nintendo"
	AggregatedRating *float64          // external critics, 0–100; nil when not available
	Rating           *float64          // IGDB community, 0–100; nil when not available
	CachedAt         time.Time
}

// GetGameDetail returns the cached detail row for the given IGDB ID.
// The second return value is false when the row is missing or stale (older than
// gameDetailTTL) — the caller should re-fetch from IGDB and call UpsertGameDetail.
func GetGameDetail(ctx context.Context, pool *pgxpool.Pool, igdbID int) (CachedGameDetail, bool, error) {
	var d CachedGameDetail
	var storeLinksJSON []byte
	var slug *string
	err := pool.QueryRow(ctx, `
		SELECT igdb_id, slug, summary, screenshots, platforms, developer, publisher, trailer_id, store_links,
		       aggregated_rating, rating, cached_at
		FROM igdb_game_details
		WHERE igdb_id = $1
	`, igdbID).Scan(
		&d.IGDBID, &slug, &d.Summary, &d.Screenshots, &d.Platforms,
		&d.Developer, &d.Publisher, &d.TrailerID, &storeLinksJSON,
		&d.AggregatedRating, &d.Rating, &d.CachedAt,
	)
	if err == pgx.ErrNoRows {
		return CachedGameDetail{}, false, nil
	}
	if err != nil {
		return CachedGameDetail{}, false, err
	}
	if slug != nil {
		d.Slug = *slug
	}
	if len(storeLinksJSON) > 0 {
		_ = json.Unmarshal(storeLinksJSON, &d.StoreLinks)
	}
	return d, time.Since(d.CachedAt) < gameDetailTTL, nil
}

// UpsertGameDetail inserts or refreshes the detail cache row for a game.
func UpsertGameDetail(ctx context.Context, pool *pgxpool.Pool, d CachedGameDetail) error {
	storeLinksJSON, err := json.Marshal(d.StoreLinks)
	if err != nil {
		return fmt.Errorf("marshal store_links: %w", err)
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO igdb_game_details (igdb_id, slug, summary, screenshots, platforms, developer, publisher, trailer_id, store_links, aggregated_rating, rating, cached_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
		ON CONFLICT (igdb_id) DO UPDATE
		  SET slug              = EXCLUDED.slug,
		      summary           = EXCLUDED.summary,
		      screenshots       = EXCLUDED.screenshots,
		      platforms         = EXCLUDED.platforms,
		      developer         = EXCLUDED.developer,
		      publisher         = EXCLUDED.publisher,
		      trailer_id        = EXCLUDED.trailer_id,
		      store_links       = EXCLUDED.store_links,
		      aggregated_rating = EXCLUDED.aggregated_rating,
		      rating            = EXCLUDED.rating,
		      cached_at         = now()
	`, d.IGDBID, d.Slug, d.Summary, d.Screenshots, d.Platforms, d.Developer, d.Publisher, d.TrailerID, storeLinksJSON, d.AggregatedRating, d.Rating)
	return err
}

func UpsertGame(ctx context.Context, pool *pgxpool.Pool, g CachedGame) error {
	var coverURL *string
	if g.CoverURL != "" {
		coverURL = &g.CoverURL
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name, cover_url, genres, release_year, release_date, category, cached_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (igdb_id) DO UPDATE
		  SET name         = EXCLUDED.name,
		      cover_url    = EXCLUDED.cover_url,
		      genres       = EXCLUDED.genres,
		      release_year = EXCLUDED.release_year,
		      release_date = EXCLUDED.release_date,
		      category     = EXCLUDED.category,
		      cached_at    = now()
	`, g.IGDBID, g.Name, coverURL, g.Genres, g.ReleaseYear, g.ReleaseDate, g.Category)
	return err
}
