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

// BacklogEntry is a game on a player's Backlog — a game they intend to play
// in the future.
type BacklogEntry struct {
	IGDBID      int
	Name        string
	CoverURL    *string
	Genres      []string
	ReleaseYear *int
	ReleaseDate *time.Time
	AddedAt     time.Time
}

// AddBacklogEntry adds a game to playerID's Backlog, placing it last in their
// order. It is idempotent — added is false if the entry already existed.
func AddBacklogEntry(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) (bool, error) {
	tag, err := pool.Exec(ctx, `
		INSERT INTO backlog_entries (player_id, igdb_id, position)
		VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM backlog_entries WHERE player_id = $1), 0))
		ON CONFLICT (player_id, igdb_id) DO NOTHING
	`, playerID, igdbID)
	if err != nil {
		return false, fmt.Errorf("add backlog entry: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// RemoveBacklogEntry removes a game from playerID's Backlog.
func RemoveBacklogEntry(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM backlog_entries WHERE player_id = $1 AND igdb_id = $2
	`, playerID, igdbID)
	if err != nil {
		return fmt.Errorf("remove backlog entry: %w", err)
	}
	return nil
}

// ListBacklogEntries returns playerID's Backlog, in the player's chosen
// order (most recently added first, until reordered).
func ListBacklogEntries(ctx context.Context, pool *pgxpool.Pool, playerID string) ([]BacklogEntry, error) {
	rows, err := pool.Query(ctx, `
		SELECT g.igdb_id, g.name, g.cover_url, g.genres, g.release_year, g.release_date, h.added_at
		FROM backlog_entries h
		JOIN igdb_games g ON g.igdb_id = h.igdb_id
		WHERE h.player_id = $1
		ORDER BY h.position ASC, h.added_at DESC
	`, playerID)
	if err != nil {
		return nil, fmt.Errorf("list backlog entries: %w", err)
	}
	defer rows.Close()

	var entries []BacklogEntry
	for rows.Next() {
		var e BacklogEntry
		if err := rows.Scan(&e.IGDBID, &e.Name, &e.CoverURL, &e.Genres, &e.ReleaseYear, &e.ReleaseDate, &e.AddedAt); err != nil {
			return nil, fmt.Errorf("scan backlog entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// ErrBacklogOrderMismatch is returned by ReorderBacklogEntries when igdbIDs
// does not contain exactly the set of games currently on playerID's Backlog.
var ErrBacklogOrderMismatch = errors.New("backlog order mismatch")

// ReorderBacklogEntries sets the order of playerID's Backlog to igdbIDs.
// igdbIDs must contain exactly the set of games currently on the player's
// Backlog, in the desired order, or ErrBacklogOrderMismatch is returned.
func ReorderBacklogEntries(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbIDs []int) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("reorder backlog entries: begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM backlog_entries WHERE player_id = $1`, playerID).Scan(&count); err != nil {
		return fmt.Errorf("reorder backlog entries: count: %w", err)
	}
	if count != len(igdbIDs) {
		return ErrBacklogOrderMismatch
	}

	for position, igdbID := range igdbIDs {
		tag, err := tx.Exec(ctx, `
			UPDATE backlog_entries SET position = $1 WHERE player_id = $2 AND igdb_id = $3
		`, position, playerID, igdbID)
		if err != nil {
			return fmt.Errorf("reorder backlog entries: update: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrBacklogOrderMismatch
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("reorder backlog entries: commit: %w", err)
	}
	return nil
}

// IsInBacklog reports whether playerID has igdbID on their Backlog.
func IsInBacklog(ctx context.Context, pool *pgxpool.Pool, playerID string, igdbID int) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM backlog_entries WHERE player_id = $1 AND igdb_id = $2)
	`, playerID, igdbID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("is in backlog: %w", err)
	}
	return exists, nil
}
