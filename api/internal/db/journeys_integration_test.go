// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// testSchema creates only the tables required by UpsertPendingJourney.
// IF NOT EXISTS makes it safe to reuse a persistent test database across runs.
const testSchema = `
CREATE TABLE IF NOT EXISTS users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    text        NOT NULL,
    provider_id text        NOT NULL,
    handle      text        NOT NULL,
    name        text        NOT NULL,
    avatar_url  text,
    bio         text,
    color       text        NOT NULL DEFAULT '#7c3aed',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);

CREATE TABLE IF NOT EXISTS igdb_games (
    igdb_id      integer     PRIMARY KEY,
    name         text        NOT NULL,
    cover_url    text,
    genres       text[]      NOT NULL DEFAULT '{}',
    release_year integer,
    category     integer,
    cached_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_journeys (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    igdb_id        integer     REFERENCES igdb_games(igdb_id),
    exe_name       text,
    window_title   text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz,
    last_heartbeat timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_journeys_dedup_idx
    ON pending_journeys(user_id, exe_name, started_at, ended_at)
    WHERE ended_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS journeys (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    igdb_id          integer     NOT NULL REFERENCES igdb_games(igdb_id),
    started_at       timestamptz NOT NULL,
    ended_at         timestamptz NOT NULL,
    duration_seconds integer     NOT NULL,
    log              text,
    played_at        timestamptz NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS activity_events (
    id            bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    actor_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          text        NOT NULL CHECK (type IN ('new_comment', 'new_follower')),
    subject_id    uuid        REFERENCES journeys(id) ON DELETE SET NULL,
    subject_title text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_actor_id_created_at_idx ON activity_events(actor_id, created_at DESC);
`

func connectTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	adminDSN := os.Getenv("TEST_DATABASE_ADMIN_URL")
	if dsn == "" || adminDSN == "" {
		t.Fatal("TEST_DATABASE_URL and TEST_DATABASE_ADMIN_URL must be set when running integration tests")
	}

	// Admin connection for DDL (schema setup). yurnik_api has DML only.
	adminPool, err := db.Connect(context.Background(), adminDSN)
	if err != nil {
		t.Fatalf("connect admin: %v", err)
	}
	defer adminPool.Close()
	if _, err = adminPool.Exec(context.Background(), testSchema); err != nil {
		t.Fatalf("setup schema: %v", err)
	}

	// API connection for the actual calls — mirrors what production uses.
	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect api: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// createTestUser inserts a unique user for this test and registers cleanup.
// provider_id is derived from t.Name() so parallel tests don't collide.
func createTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, 'testuser', 'Test User')
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, t.Name()).Scan(&id)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})
	return id
}

func countPending(t *testing.T, pool *pgxpool.Pool, userID, exeName string) int {
	t.Helper()
	var n int
	err := pool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM pending_journeys WHERE user_id = $1 AND exe_name = $2",
		userID, exeName).Scan(&n)
	if err != nil {
		t.Fatalf("count pending journeys: %v", err)
	}
	return n
}

func TestUpsertPendingJourney_NewSession(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)

	startedAt := time.Now().UTC().Add(-1 * time.Hour)
	endedAt := time.Now().UTC()

	id, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", startedAt, nil, &endedAt)
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if id == "" {
		t.Fatal("expected a non-empty ID")
	}
	if countPending(t, pool, userID, "game.exe") != 1 {
		t.Fatal("expected exactly one pending journey")
	}
}

func TestUpsertPendingJourney_ExactDuplicateReturnsExistingID(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)

	startedAt := time.Now().UTC().Add(-1 * time.Hour)
	endedAt := time.Now().UTC()

	id1, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", startedAt, nil, &endedAt)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Identical call — simulates a retry after a network failure.
	id2, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", startedAt, nil, &endedAt)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	if id1 != id2 {
		t.Fatalf("expected same ID on retry: got %s and %s", id1, id2)
	}
	if countPending(t, pool, userID, "game.exe") != 1 {
		t.Fatal("expected exactly one pending journey after duplicate")
	}
}

func TestUpsertPendingJourney_MergesSessionWithinWindow(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)

	// First session: ended 10 minutes ago.
	firstStart := time.Now().UTC().Add(-70 * time.Minute)
	firstEnd := time.Now().UTC().Add(-10 * time.Minute)

	id1, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", firstStart, nil, &firstEnd)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Second session: starts now (10 min gap — within the 15 min merge window).
	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)

	id2, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", secondStart, nil, &secondEnd)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	if id1 != id2 {
		t.Fatalf("expected sessions to merge into the same ID: got %s and %s", id1, id2)
	}
	if countPending(t, pool, userID, "game.exe") != 1 {
		t.Fatal("expected exactly one pending journey after merge")
	}

	// Verify ended_at was extended to the second session's end time.
	var storedEnd time.Time
	err = pool.QueryRow(context.Background(),
		"SELECT ended_at FROM pending_journeys WHERE id = $1", id1).Scan(&storedEnd)
	if err != nil {
		t.Fatalf("read ended_at: %v", err)
	}
	if !storedEnd.Truncate(time.Second).Equal(secondEnd.Truncate(time.Second)) {
		t.Fatalf("expected ended_at to be extended to %v, got %v", secondEnd, storedEnd)
	}
}

func TestUpsertPendingJourney_DoesNotMergeOutsideWindow(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)

	// First session: ended 20 minutes ago (outside the 15 min merge window).
	firstStart := time.Now().UTC().Add(-80 * time.Minute)
	firstEnd := time.Now().UTC().Add(-20 * time.Minute)

	_, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", firstStart, nil, &firstEnd)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)

	_, err = db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", secondStart, nil, &secondEnd)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	if countPending(t, pool, userID, "game.exe") != 2 {
		t.Fatal("expected two separate pending journeys — gap was outside merge window")
	}
}

func TestUpsertPendingJourney_DoesNotMergeActiveSession(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)

	// Active session (no ended_at) — should never be a merge candidate.
	firstStart := time.Now().UTC().Add(-5 * time.Minute)
	_, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", firstStart, nil, nil)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)
	_, err = db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", "My Game", secondStart, nil, &secondEnd)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	if countPending(t, pool, userID, "game.exe") != 2 {
		t.Fatal("expected two rows — active sessions must not be merged")
	}
}
