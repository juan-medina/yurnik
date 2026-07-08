// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package main

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/juan-medina/yurnik/internal/db"
)

func TestMaintenanceEvictsOldData(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Fatal("TEST_DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Defensive cleanup: delete these exact test users in case a previous bad test run
	// crashed before it could clean them up, leaving orphan notifications behind.
	pool.Exec(ctx, "DELETE FROM users WHERE provider_id IN ('maint_old', 'maint_new')")

	// Create test user 1 (for old data)
	var userID1 string
	err = pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name) 
		VALUES ('test', 'maint_old', 'maintold', 'Maint Old') 
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`).Scan(&userID1)
	if err != nil {
		t.Fatalf("insert user 1: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", userID1)
	})

	// Create test user 2 (for new data)
	var userID2 string
	err = pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name) 
		VALUES ('test', 'maint_new', 'maintnew', 'Maint New') 
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`).Scan(&userID2)
	if err != nil {
		t.Fatalf("insert user 2: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", userID2)
	})

	now := time.Now()
	pendingOld := now.Add(-31 * 24 * time.Hour)
	pendingNew := now.Add(-29 * 24 * time.Hour)
	notificationsOld := now.Add(-61 * 24 * time.Hour)
	notificationsNew := now.Add(-59 * 24 * time.Hour)

	// Insert pending journeys
	insertPending := `INSERT INTO pending_journeys (user_id, status, created_at) VALUES ($1, 'active', $2)`
	if _, err := pool.Exec(ctx, insertPending, userID1, pendingOld); err != nil {
		t.Fatalf("insert old pending journey: %v", err)
	}
	if _, err := pool.Exec(ctx, insertPending, userID2, pendingNew); err != nil {
		t.Fatalf("insert new pending journey: %v", err)
	}

	// Insert notifications (one per user to avoid unique constraint)
	insertNotification := `INSERT INTO notifications (recipient_id, type, updated_at, batch_until) VALUES ($1, 'new_follower', $2, $2)`
	if _, err := pool.Exec(ctx, insertNotification, userID1, notificationsOld); err != nil {
		t.Fatalf("insert old notification: %v", err)
	}
	if _, err := pool.Exec(ctx, insertNotification, userID2, notificationsNew); err != nil {
		t.Fatalf("insert new notification: %v", err)
	}

	// Run maintenance
	if err := evictData(ctx, pool); err != nil {
		t.Fatalf("evictData failed: %v", err)
	}

	// Assert ONLY ONE pending journey remains for our test users (the new one)
	var pendingCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM pending_journeys WHERE user_id IN ($1, $2)", userID1, userID2).Scan(&pendingCount); err != nil {
		t.Fatalf("count pending: %v", err)
	}
	if pendingCount != 1 {
		t.Errorf("expected 1 pending journey, got %d", pendingCount)
	}

	// Assert ONLY ONE notification remains for our test users (the new one)
	var notificationsCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM notifications WHERE recipient_id IN ($1, $2)", userID1, userID2).Scan(&notificationsCount); err != nil {
		t.Fatalf("count notifications: %v", err)
	}
	if notificationsCount != 1 {
		t.Errorf("expected 1 notification, got %d", notificationsCount)
	}
}

type mockIGDBFetcher struct {
	dates map[int]*time.Time
}

func (m *mockIGDBFetcher) GetBatchReleaseDates(ctx context.Context, igdbIDs []int) (map[int]*time.Time, error) {
	return m.dates, nil
}

func TestMaintenanceRefreshUpcomingReleases(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Fatal("TEST_DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Cleanup test data
	pool.Exec(ctx, "DELETE FROM users WHERE provider_id IN ('maint_hrz_1', 'maint_hrz_2')")
	pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id IN (999991, 999992)")

	// Create users
	var u1, u2 string
	err = pool.QueryRow(ctx, "INSERT INTO users (provider, provider_id, handle, name) VALUES ('test', 'maint_hrz_1', 'mhrz1', 'Hrz 1') RETURNING id").Scan(&u1)
	if err != nil { t.Fatalf("insert u1: %v", err) }
	err = pool.QueryRow(ctx, "INSERT INTO users (provider, provider_id, handle, name) VALUES ('test', 'maint_hrz_2', 'mhrz2', 'Hrz 2') RETURNING id").Scan(&u2)
	if err != nil { t.Fatalf("insert u2: %v", err) }
	
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id IN ($1, $2)", u1, u2)
		pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id IN (999991, 999992)")
	})

	_, err = pool.Exec(ctx, "INSERT INTO igdb_games (igdb_id, name, cover_url, genres) VALUES (999991, 'Test Game 1', '', '{}'), (999992, 'Test Game 2', '', '{}')")
	if err != nil { t.Fatalf("insert games: %v", err) }

	// Create backlog entries
	_, err = pool.Exec(ctx, "INSERT INTO backlog_entries (player_id, igdb_id) VALUES ($1, 999991), ($2, 999992)", u1, u2)
	if err != nil { t.Fatalf("insert backlog: %v", err) }

	// Mock IGDB response: Game 1 releases in 3 days, Game 2 has no release date
	now := time.Now()
	release1 := now.Add(3 * 24 * time.Hour)
	mockFetcher := &mockIGDBFetcher{
		dates: map[int]*time.Time{
			999991: &release1,
			999992: nil,
		},
	}

	// 1. First run
	if err := refreshUpcomingReleases(ctx, pool, mockFetcher); err != nil {
		t.Fatalf("refreshUpcomingReleases failed: %v", err)
	}

	// Assert game 1 updated
	var d1 time.Time
	if err := pool.QueryRow(ctx, "SELECT release_date FROM igdb_games WHERE igdb_id = 999991").Scan(&d1); err != nil {
		t.Fatalf("query release_date 1: %v", err)
	}
	if d1.IsZero() {
		t.Error("game 1 release_date not updated")
	}

	// Assert 1 notification created for user 1
	var c int
	var title string
	if err := pool.QueryRow(ctx, "SELECT COUNT(*), MAX(subject_title) FROM notifications WHERE recipient_id = $1 AND type = 'backlog_release'", u1).Scan(&c, &title); err != nil {
		t.Fatalf("count notifications u1: %v", err)
	}
	if c != 1 {
		t.Errorf("expected 1 notification for user 1, got %d", c)
	}
	if title != "Test Game 1" {
		t.Errorf("expected subject_title 'Test Game 1', got %q", title)
	}

	// Assert 0 notifications for user 2
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND type = 'backlog_release'", u2).Scan(&c); err != nil {
		t.Fatalf("count notifications u2: %v", err)
	}
	if c != 0 {
		t.Errorf("expected 0 notifications for user 2, got %d", c)
	}

	// 2. Second run - should NOT create duplicate notifications due to NOT EXISTS
	if err := refreshUpcomingReleases(ctx, pool, mockFetcher); err != nil {
		t.Fatalf("refreshUpcomingReleases second run failed: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND type = 'backlog_release'", u1).Scan(&c); err != nil {
		t.Fatalf("count notifications u1 second run: %v", err)
	}
	if c != 1 {
		t.Errorf("expected still 1 notification for user 1, got %d", c)
	}
}
