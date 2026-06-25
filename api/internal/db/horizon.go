// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// HorizonEntry is a game on a player's Horizon — a game they intend to play
// in the future.
type HorizonEntry struct {
	IGDBID      int
	Name        string
	CoverURL    *string
	Genres      []string
	ReleaseYear *int
	ReleaseDate *time.Time
	AddedAt     time.Time
}

// AddHorizonEntry adds a game to playerID's Horizon, placing it last in their
// order. It is idempotent — added is false if the entry already existed.
func AddHorizonEntry(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) (bool, error) {
	tag, err := pool.Exec(ctx, `
		INSERT INTO horizon_entries (player_id, igdb_id, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM horizon_entries WHERE player_id = $1), 0))
		ON CONFLICT (player_id, igdb_id) DO NOTHING
	`, playerID, igdbID)
	if err != nil {
		return false, fmt.Errorf("add horizon entry: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// RemoveHorizonEntry removes a game from playerID's Horizon.
func RemoveHorizonEntry(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM horizon_entries WHERE player_id = $1 AND igdb_id = $2
	`, playerID, igdbID)
	if err != nil {
		return fmt.Errorf("remove horizon entry: %w", err)
	}
	return nil
}

// ListHorizonEntries returns playerID's Horizon, in the player's chosen
// order (most recently added first, until reordered).
func ListHorizonEntries(ctx context.Context, pool *pgxpool.Pool, playerID string) ([]HorizonEntry, error) {
	rows, err := pool.Query(ctx, `
		SELECT g.igdb_id, g.name, g.cover_url, g.genres, g.release_year, g.release_date, h.added_at
		FROM horizon_entries h
		JOIN igdb_games g ON g.igdb_id = h.igdb_id
		WHERE h.player_id = $1
		ORDER BY h.position ASC, h.added_at DESC
	`, playerID)
	if err != nil {
		return nil, fmt.Errorf("list horizon entries: %w", err)
	}
	defer rows.Close()

	var entries []HorizonEntry
	for rows.Next() {
		var e HorizonEntry
		if err := rows.Scan(&e.IGDBID, &e.Name, &e.CoverURL, &e.Genres, &e.ReleaseYear, &e.ReleaseDate, &e.AddedAt); err != nil {
			return nil, fmt.Errorf("scan horizon entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// ErrHorizonOrderMismatch is returned by ReorderHorizonEntries when igdbIDs
// does not contain exactly the set of games currently on playerID's Horizon.
var ErrHorizonOrderMismatch = errors.New("horizon order mismatch")

// ReorderHorizonEntries sets the order of playerID's Horizon to igdbIDs.
// igdbIDs must contain exactly the set of games currently on the player's
// Horizon, in the desired order, or ErrHorizonOrderMismatch is returned.
func ReorderHorizonEntries(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbIDs []int) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("reorder horizon entries: begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM horizon_entries WHERE player_id = $1`, playerID).Scan(&count); err != nil {
		return fmt.Errorf("reorder horizon entries: count: %w", err)
	}
	if count != len(igdbIDs) {
		return ErrHorizonOrderMismatch
	}

	for position, igdbID := range igdbIDs {
		tag, err := tx.Exec(ctx, `
			UPDATE horizon_entries SET position = $1 WHERE player_id = $2 AND igdb_id = $3
		`, position, playerID, igdbID)
		if err != nil {
			return fmt.Errorf("reorder horizon entries: update: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrHorizonOrderMismatch
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("reorder horizon entries: commit: %w", err)
	}
	return nil
}

// IsInHorizon reports whether playerID has igdbID on their Horizon.
func IsInHorizon(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM horizon_entries WHERE player_id = $1 AND igdb_id = $2)
	`, playerID, igdbID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("is in horizon: %w", err)
	}
	return exists, nil
}
