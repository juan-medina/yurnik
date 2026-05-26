// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CachedGame struct {
	IGDBID   int
	Name     string
	CoverURL string // empty string means no cover
	Genres   []string
}

func UpsertGame(ctx context.Context, pool *pgxpool.Pool, g CachedGame) error {
	var coverURL *string
	if g.CoverURL != "" {
		coverURL = &g.CoverURL
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name, cover_url, genres, cached_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (igdb_id) DO UPDATE
		  SET name      = EXCLUDED.name,
		      cover_url = EXCLUDED.cover_url,
		      genres    = EXCLUDED.genres,
		      cached_at = now()
	`, g.IGDBID, g.Name, coverURL, g.Genres)
	return err
}
