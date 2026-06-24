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
	// crashed before it could clean them up, leaving orphan echoes behind.
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
	echoesOld := now.Add(-61 * 24 * time.Hour)
	echoesNew := now.Add(-59 * 24 * time.Hour)

	// Insert pending journeys
	insertPending := `INSERT INTO pending_journeys (user_id, status, created_at) VALUES ($1, 'active', $2)`
	if _, err := pool.Exec(ctx, insertPending, userID1, pendingOld); err != nil {
		t.Fatalf("insert old pending journey: %v", err)
	}
	if _, err := pool.Exec(ctx, insertPending, userID2, pendingNew); err != nil {
		t.Fatalf("insert new pending journey: %v", err)
	}

	// Insert echoes (one per user to avoid unique constraint)
	insertEcho := `INSERT INTO echoes (recipient_id, type, updated_at) VALUES ($1, 'new_follower', $2)`
	if _, err := pool.Exec(ctx, insertEcho, userID1, echoesOld); err != nil {
		t.Fatalf("insert old echo: %v", err)
	}
	if _, err := pool.Exec(ctx, insertEcho, userID2, echoesNew); err != nil {
		t.Fatalf("insert new echo: %v", err)
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

	// Assert ONLY ONE echo remains for our test users (the new one)
	var echoesCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM echoes WHERE recipient_id IN ($1, $2)", userID1, userID2).Scan(&echoesCount); err != nil {
		t.Fatalf("count echoes: %v", err)
	}
	if echoesCount != 1 {
		t.Errorf("expected 1 echo, got %d", echoesCount)
	}
}
