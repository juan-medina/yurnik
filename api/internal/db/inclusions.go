// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Inclusion is an exe the agent must forcefully track as a game.
type Inclusion struct {
	ExeName string
}

// IsIncluded returns true if the given exe is on the user's inclusion list.
func IsIncluded(ctx context.Context, pool *pgxpool.Pool, userID, exeName string) (bool, error) {
	var included bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM exe_inclusions WHERE user_id = $1 AND exe_name = $2)
	`, userID, exeName).Scan(&included)
	return included, err
}

// InsertInclusion adds an exe to the user's inclusion list.
// Returns nil if the exe is already included (idempotent).
func InsertInclusion(ctx context.Context, pool *pgxpool.Pool, userID, exeName string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO exe_inclusions (user_id, exe_name)
		VALUES ($1, $2)
		ON CONFLICT (user_id, exe_name) DO NOTHING
	`, userID, exeName)
	return err
}

// ListInclusions returns all included exes for the given user.
func ListInclusions(ctx context.Context, pool *pgxpool.Pool, userID string) ([]Inclusion, error) {
	rows, err := pool.Query(ctx, `
		SELECT exe_name FROM exe_inclusions WHERE user_id = $1 ORDER BY exe_name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Inclusion
	for rows.Next() {
		var i Inclusion
		if err := rows.Scan(&i.ExeName); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// DeleteInclusion removes an exe from the user's inclusion list.
func DeleteInclusion(ctx context.Context, pool *pgxpool.Pool, userID, exeName string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM exe_inclusions WHERE user_id = $1 AND exe_name = $2
	`, userID, exeName)
	return err
}
