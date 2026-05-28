// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// InsertExclusion adds an exe to the user's exclusion list.
// Returns nil if the exe is already excluded (idempotent).
func InsertExclusion(ctx context.Context, pool *pgxpool.Pool, did, exeName string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO exe_exclusions (did, exe_name)
		VALUES ($1, $2)
		ON CONFLICT (did, exe_name) DO NOTHING
	`, did, exeName)
	return err
}
