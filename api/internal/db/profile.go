// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProfileRecentGame struct {
	IGDBID      int
	Name        string
	CoverURL    *string
	ReleaseYear *int
	LastPlayed  time.Time
}

type ProfileGenreHours struct {
	Genre   string
	Seconds int
}

type ProfileSummary struct {
	JourneyCount int
	TotalSeconds int
	RecentGames  []ProfileRecentGame
	GenreHours   []ProfileGenreHours
}

// GetProfileSummary returns aggregated profile data for the given user:
// journey count, total playtime, 5 most recently played distinct games,
// and hours per genre (full credit regardless of how many genres a game has).
func GetProfileSummary(ctx context.Context, pool *pgxpool.Pool, userID string) (ProfileSummary, error) {
	var s ProfileSummary

	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
		FROM journeys WHERE user_id = $1
	`, userID).Scan(&s.JourneyCount, &s.TotalSeconds); err != nil {
		return s, err
	}

	gameRows, err := pool.Query(ctx, `
		SELECT igdb_id, game_name, cover_url, release_year, last_played FROM (
			SELECT DISTINCT ON (j.igdb_id)
				j.igdb_id, g.name AS game_name, g.cover_url, g.release_year, j.played_at AS last_played
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			WHERE j.user_id = $1
			ORDER BY j.igdb_id, j.played_at DESC, j.created_at DESC
		) sub
		ORDER BY last_played DESC
		LIMIT 5
	`, userID)
	if err != nil {
		return s, err
	}
	defer gameRows.Close()
	for gameRows.Next() {
		var g ProfileRecentGame
		if err := gameRows.Scan(&g.IGDBID, &g.Name, &g.CoverURL, &g.ReleaseYear, &g.LastPlayed); err != nil {
			return s, err
		}
		s.RecentGames = append(s.RecentGames, g)
	}
	if err := gameRows.Err(); err != nil {
		return s, err
	}

	genreRows, err := pool.Query(ctx, `
		SELECT genre, SUM(j.duration_seconds) AS total_seconds
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id
		CROSS JOIN UNNEST(g.genres) AS genre
		WHERE j.user_id = $1
		GROUP BY genre
		ORDER BY total_seconds DESC
		LIMIT 8
	`, userID)
	if err != nil {
		return s, err
	}
	defer genreRows.Close()
	for genreRows.Next() {
		var gh ProfileGenreHours
		if err := genreRows.Scan(&gh.Genre, &gh.Seconds); err != nil {
			return s, err
		}
		s.GenreHours = append(s.GenreHours, gh)
	}
	return s, genreRows.Err()
}
