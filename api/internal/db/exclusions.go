// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Exclusion is an exe the agent must never create a pending journey for.
type Exclusion struct {
	ExeName  string
	PathHash string
}

// GameHint is a learned exe → IGDB game mapping for a user.
type GameHint struct {
	ExeName  string
	PathHash string
	IGDBID   int
	Title    string
}

// IsExcluded returns true if the given exe is on the user's exclusion list.
func IsExcluded(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string) (bool, error) {
	var excluded bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM exe_exclusions 
			WHERE user_id = $1 AND exe_name = $2 AND (path_hash = $3 OR path_hash = '')
		)
	`, userID, exeName, pathHash).Scan(&excluded)
	return excluded, err
}

// GetGameHintIGDBID returns the IGDB ID from a learned exe→game mapping, or nil if none exists.
// It matches exact path_hash first, and falls back to a global hint (empty path_hash).
func GetGameHintIGDBID(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string) (*int, error) {
	var igdbID int
	err := pool.QueryRow(ctx, `
		SELECT igdb_id FROM exe_game_hints 
		WHERE user_id = $1 AND exe_name = $2 AND (path_hash = $3 OR path_hash = '')
		ORDER BY CASE WHEN path_hash = $3 THEN 0 ELSE 1 END
		LIMIT 1
	`, userID, exeName, pathHash).Scan(&igdbID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &igdbID, nil
}

// InsertExclusion adds an exe to the user's exclusion list.
// Returns nil if the exe is already excluded (idempotent).
func InsertExclusion(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO exe_exclusions (user_id, exe_name, path_hash)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, exe_name, path_hash) DO NOTHING
	`, userID, exeName, pathHash)
	return err
}

// ListExclusions returns all excluded exes for the given user.
func ListExclusions(ctx context.Context, pool *pgxpool.Pool, userID string) ([]Exclusion, error) {
	rows, err := pool.Query(ctx, `
		SELECT exe_name, path_hash FROM exe_exclusions WHERE user_id = $1 ORDER BY exe_name, path_hash
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Exclusion
	for rows.Next() {
		var e Exclusion
		if err := rows.Scan(&e.ExeName, &e.PathHash); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// DeleteExclusion removes an exe from the user's exclusion list.
func DeleteExclusion(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM exe_exclusions WHERE user_id = $1 AND exe_name = $2 AND path_hash = $3
	`, userID, exeName, pathHash)
	return err
}

// UpsertGameHint records or updates the IGDB game for an exe and path_hash.
func UpsertGameHint(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string, igdbID int) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO exe_game_hints (user_id, exe_name, path_hash, igdb_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, exe_name, path_hash) DO UPDATE SET igdb_id = EXCLUDED.igdb_id, updated_at = now()
	`, userID, exeName, pathHash, igdbID)
	return err
}

// ListGameHints returns all exe→game hints for the given user, joining game titles.
func ListGameHints(ctx context.Context, pool *pgxpool.Pool, userID string) ([]GameHint, error) {
	rows, err := pool.Query(ctx, `
		SELECT h.exe_name, h.path_hash, h.igdb_id, g.name
		FROM exe_game_hints h
		JOIN igdb_games g ON g.igdb_id = h.igdb_id
		WHERE h.user_id = $1
		ORDER BY h.exe_name, h.path_hash
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []GameHint
	for rows.Next() {
		var h GameHint
		if err := rows.Scan(&h.ExeName, &h.PathHash, &h.IGDBID, &h.Title); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// DeleteGameHint removes an exe→game hint for the given user.
func DeleteGameHint(ctx context.Context, pool *pgxpool.Pool, userID, exeName, pathHash string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM exe_game_hints WHERE user_id = $1 AND exe_name = $2 AND path_hash = $3
	`, userID, exeName, pathHash)
	return err
}

