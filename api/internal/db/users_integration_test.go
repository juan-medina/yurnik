// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// createTestUserWithName inserts a user with a specific display name, so
// follow-list pagination tests can control alphabetical order.
func createTestUserWithName(t *testing.T, pool *pgxpool.Pool, suffix, name string) string {
	t.Helper()
	ctx := context.Background()
	var id string
	handle := strings.ToLower(strings.NewReplacer("/", "_", " ", "_", ",", "_").Replace(t.Name()+suffix))
	if len(handle) > 63 {
		handle = handle[:63]
	}
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, $2, $3)
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, t.Name()+suffix, handle, name).Scan(&id)
	if err != nil {
		t.Fatalf("create test user with name: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})
	return id
}

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

func TestGetFollowers_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	// target is the user whose followers we'll list
	target := createTestUserWithName(t, pool, "-target", "Target")
	// followers ordered alphabetically: Alice, Bob, Carol
	alice := createTestUserWithName(t, pool, "-alice", "Alice")
	bob := createTestUserWithName(t, pool, "-bob", "Bob")
	carol := createTestUserWithName(t, pool, "-carol", "Carol")

	for _, follower := range []string{carol, alice, bob} {
		if err := db.FollowUser(ctx, pool, follower, target); err != nil {
			t.Fatalf("seed follow: %v", err)
		}
		t.Cleanup(func() {
			pool.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", follower, target)
		})
	}

	page1, err := db.GetFollowers(ctx, pool, target, 2, "")
	if err != nil {
		t.Fatalf("page1: %v", err)
	}
	if len(page1) != 2 || page1[0].ID != alice || page1[1].ID != bob {
		t.Fatalf("page1 = [%v, %v], want [alice, bob]", page1[0].Name, page1[1].Name)
	}

	cursor := db.EncodeFollowCursor(page1[1].Name, page1[1].ID)
	page2, err := db.GetFollowers(ctx, pool, target, 2, cursor)
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if len(page2) != 1 || page2[0].ID != carol {
		t.Fatalf("page2 = %v, want [carol]", page2)
	}
}

func TestGetFollowing_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	// actor follows three users alphabetically: Alice, Bob, Carol
	actor := createTestUserWithName(t, pool, "-actor", "Actor")
	alice := createTestUserWithName(t, pool, "-alice2", "Alice")
	bob := createTestUserWithName(t, pool, "-bob2", "Bob")
	carol := createTestUserWithName(t, pool, "-carol2", "Carol")

	for _, followee := range []string{carol, alice, bob} {
		if err := db.FollowUser(ctx, pool, actor, followee); err != nil {
			t.Fatalf("seed follow: %v", err)
		}
		t.Cleanup(func() {
			pool.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", actor, followee)
		})
	}

	page1, err := db.GetFollowing(ctx, pool, actor, 2, "")
	if err != nil {
		t.Fatalf("page1: %v", err)
	}
	if len(page1) != 2 || page1[0].ID != alice || page1[1].ID != bob {
		t.Fatalf("page1 = [%v, %v], want [alice, bob]", page1[0].Name, page1[1].Name)
	}

	cursor := db.EncodeFollowCursor(page1[1].Name, page1[1].ID)
	page2, err := db.GetFollowing(ctx, pool, actor, 2, cursor)
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if len(page2) != 1 || page2[0].ID != carol {
		t.Fatalf("page2 = %v, want [carol]", page2)
	}
}
