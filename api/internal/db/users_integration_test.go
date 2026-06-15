// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// TestDeleteUser_cascades verifies that deleting a user removes their owned
// rows (here, a follow relationship) via ON DELETE CASCADE, and that the
// user row itself is gone.
func TestDeleteUser_cascades(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	userID := createTestUser(t, pool)
	otherID := createSecondTestUser(t, pool)

	if err := db.FollowUser(ctx, pool, userID, otherID); err != nil {
		t.Fatalf("seed follow: %v", err)
	}

	if err := db.DeleteUser(ctx, pool, userID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	if _, err := db.GetUser(ctx, pool, userID); err == nil {
		t.Error("expected deleted user to be gone, but GetUser succeeded")
	}

	following, err := db.IsFollowing(ctx, pool, userID, otherID)
	if err != nil {
		t.Fatalf("is following: %v", err)
	}
	if following {
		t.Error("follow row for deleted user still present (cascade should remove it)")
	}
}

// createSecondTestUser inserts a second unique user for cascade tests that
// need two distinct accounts (e.g. follow relationships).
func createSecondTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, 'testuser2', 'Test User 2')
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, t.Name()+"_2").Scan(&id)
	if err != nil {
		t.Fatalf("create second test user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})
	return id
}
