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

// TestSuspendUser_blocksAndLifts verifies that SuspendUser sets suspended_at,
// the user appears in ListSuspendedUsers, and UnsuspendUser clears it.
func TestSuspendUser_blocksAndLifts(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	userID := createTestUser(t, pool)

	// Not suspended initially.
	u, err := db.GetUser(ctx, pool, userID)
	if err != nil {
		t.Fatalf("get user: %v", err)
	}
	if u.SuspendedAt != nil {
		t.Error("new user should not be suspended")
	}

	// Suspend.
	if err := db.SuspendUser(ctx, pool, userID); err != nil {
		t.Fatalf("suspend user: %v", err)
	}

	u, err = db.GetUser(ctx, pool, userID)
	if err != nil {
		t.Fatalf("get user after suspend: %v", err)
	}
	if u.SuspendedAt == nil {
		t.Error("suspended_at should be set after SuspendUser")
	}

	// Appears in the suspended list.
	suspended, err := db.ListSuspendedUsers(ctx, pool)
	if err != nil {
		t.Fatalf("list suspended: %v", err)
	}
	found := false
	for _, su := range suspended {
		if su.ID == userID {
			found = true
			break
		}
	}
	if !found {
		t.Error("suspended user should appear in ListSuspendedUsers")
	}

	// Unsuspend.
	if err := db.UnsuspendUser(ctx, pool, userID); err != nil {
		t.Fatalf("unsuspend user: %v", err)
	}

	u, err = db.GetUser(ctx, pool, userID)
	if err != nil {
		t.Fatalf("get user after unsuspend: %v", err)
	}
	if u.SuspendedAt != nil {
		t.Error("suspended_at should be cleared after UnsuspendUser")
	}

	// No longer in the suspended list.
	suspended, err = db.ListSuspendedUsers(ctx, pool)
	if err != nil {
		t.Fatalf("list suspended after unsuspend: %v", err)
	}
	for _, su := range suspended {
		if su.ID == userID {
			t.Error("unsuspended user should not appear in ListSuspendedUsers")
		}
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
