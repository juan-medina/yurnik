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
    path_hash      text,
    window_title   text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz,
    last_heartbeat timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_journeys ADD COLUMN IF NOT EXISTS path_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS pending_journeys_dedup_idx
    ON pending_journeys(user_id, exe_name, started_at);

CREATE TABLE IF NOT EXISTS journeys (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    igdb_id          integer     NOT NULL REFERENCES igdb_games(igdb_id),
    started_at       timestamptz NOT NULL,
    ended_at         timestamptz NOT NULL,
    duration_seconds integer     NOT NULL,
    log              text,
    played_at        date        NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS journeys_dedup_idx
    ON journeys(user_id, igdb_id, started_at);

ALTER TABLE journeys ALTER COLUMN played_at TYPE date USING played_at::date;

CREATE TABLE IF NOT EXISTS comments (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id uuid        NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS activity_events (
    id              bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    actor_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            text        NOT NULL CHECK (type IN ('new_comment', 'new_follower')),
    subject_id      uuid        REFERENCES journeys(id) ON DELETE CASCADE,
    subject_title   text,
    subject_igdb_id integer     REFERENCES igdb_games(igdb_id),
    comment_id      uuid        REFERENCES comments(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_actor_id_created_at_idx ON activity_events(actor_id, created_at DESC);

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS subject_igdb_id integer REFERENCES igdb_games(igdb_id);
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_type_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_check
    CHECK (type IN ('new_comment', 'new_follower', 'backlog_add'));

DELETE FROM activity_events WHERE type = 'new_comment' AND subject_id IS NULL;
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_subject_id_fkey;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_subject_id_fkey
    FOREIGN KEY (subject_id) REFERENCES journeys(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS backlog_entries (
    id        bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    player_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    igdb_id   integer     NOT NULL REFERENCES igdb_games(igdb_id),
    added_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_id, igdb_id)
);

CREATE INDEX IF NOT EXISTS backlog_entries_player_id_added_at_idx ON backlog_entries (player_id, added_at DESC);
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

	id, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", startedAt, nil, &endedAt)
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

	id1, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", startedAt, nil, &endedAt)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Identical call — simulates a retry after a network failure.
	id2, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", startedAt, nil, &endedAt)
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

	id1, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", firstStart, nil, &firstEnd)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Second session: starts now (10 min gap — within the 15 min merge window).
	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)

	id2, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", secondStart, nil, &secondEnd)
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

	_, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", firstStart, nil, &firstEnd)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)

	_, err = db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", secondStart, nil, &secondEnd)
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
	_, err := db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", firstStart, nil, nil)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	secondStart := time.Now().UTC()
	secondEnd := time.Now().UTC().Add(30 * time.Minute)
	_, err = db.UpsertPendingJourney(context.Background(), pool, userID, "game.exe", nil, "My Game", secondStart, nil, &secondEnd)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	if countPending(t, pool, userID, "game.exe") != 2 {
		t.Fatal("expected two rows — active sessions must not be merged")
	}
}

func TestListJourneysByUser_SameDayTiebreaksByCreatedAt(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userID := createTestUser(t, pool)

	if _, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name) VALUES (90101, 'Tiebreak Game')
		ON CONFLICT (igdb_id) DO NOTHING
	`); err != nil {
		t.Fatalf("insert igdb_games: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = 90101") })

	playedAt := time.Now().UTC().Truncate(24 * time.Hour)
	older := playedAt.Add(8 * time.Hour)
	newer := playedAt.Add(9 * time.Hour)

	var olderID, newerID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO journeys (user_id, igdb_id, started_at, ended_at, duration_seconds, played_at, created_at)
		VALUES ($1, 90101, $2, $2, 3600, $3, $2)
		RETURNING id
	`, userID, older, playedAt).Scan(&olderID); err != nil {
		t.Fatalf("insert older journey: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO journeys (user_id, igdb_id, started_at, ended_at, duration_seconds, played_at, created_at)
		VALUES ($1, 90101, $2, $2, 3600, $3, $2)
		RETURNING id
	`, userID, newer, playedAt).Scan(&newerID); err != nil {
		t.Fatalf("insert newer journey: %v", err)
	}

	journeys, err := db.ListJourneysByUser(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	if len(journeys) != 2 {
		t.Fatalf("expected 2 journeys, got %d", len(journeys))
	}
	// Same played_at — most-recently-created (newerID) sorts first.
	if journeys[0].ID != newerID || journeys[1].ID != olderID {
		t.Fatalf("expected [%s, %s], got [%s, %s]", newerID, olderID, journeys[0].ID, journeys[1].ID)
	}
}

func TestUpsertPendingJourney_DoubleSubmit(t *testing.T) {
	pool := connectTestDB(t)
	userID := createTestUser(t, pool)
	ctx := context.Background()

	startedAt := time.Now().UTC()
	endedAt1 := startedAt.Add(30 * time.Minute)
	endedAt2 := startedAt.Add(30*time.Minute + 5*time.Second) // Slightly different end times from same session start
	
	igdbID := 90102
	if _, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name) VALUES ($1, 'Double Submit Game')
		ON CONFLICT (igdb_id) DO NOTHING
	`, igdbID); err != nil {
		t.Fatalf("insert igdb_games: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = $1", igdbID) })

	// First submit
	id1, err := db.UpsertPendingJourney(ctx, pool, userID, "game.exe", nil, "Game", startedAt, &igdbID, &endedAt1)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Insert the journey as the handler would
	playedAt := time.Date(startedAt.Year(), startedAt.Month(), startedAt.Day(), 0, 0, 0, 0, time.UTC)
	journeyID1, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          userID,
		IGDBID:          igdbID,
		StartedAt:       startedAt,
		EndedAt:         endedAt1,
		DurationSeconds: 1800,
		PlayedAt:        playedAt,
	})
	if err != nil {
		t.Fatalf("first insert: %v", err)
	}
	_ = db.DeletePendingJourney(ctx, pool, id1, userID)

	// Second submit (duplicate from agent retrying or double-queuing)
	id2, err := db.UpsertPendingJourney(ctx, pool, userID, "game.exe", nil, "Game", startedAt, &igdbID, &endedAt2)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}


	// It should return a valid pending journey ID. The handler then attempts to insert it again.
	_, errInsert := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          userID,
		IGDBID:          igdbID,
		StartedAt:       startedAt,
		EndedAt:         endedAt2,
		DurationSeconds: 1805,
		PlayedAt:        playedAt,
	})
	
	if errInsert == nil {
		t.Fatalf("expected unique constraint violation on second insert, got nil")
	}
	
	// The handler expects errInsert to be handled as duplicate, but this proves the DB stops it.
	_ = db.DeletePendingJourney(ctx, pool, id2, userID)

	// Verify only one journey exists
	journeys, err := db.ListJourneysByUser(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	if len(journeys) != 1 {
		t.Fatalf("expected exactly 1 journey, got %d", len(journeys))
	}
	if journeys[0].ID != journeyID1 {
		t.Fatalf("expected journey ID to match the first insert")
	}
}

func TestJourneys_TotalDurationSeconds(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userID := createTestUser(t, pool)

	igdbID := 90901
	_, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name) VALUES ($1, 'Total Duration Game')
		ON CONFLICT (igdb_id) DO NOTHING
	`, igdbID)
	if err != nil {
		t.Fatalf("insert igdb_games: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = $1", igdbID) })

	t1 := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 6, 2, 10, 0, 0, 0, time.UTC)

	j1, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          userID,
		IGDBID:          igdbID,
		StartedAt:       t1,
		EndedAt:         t1.Add(3600 * time.Second),
		DurationSeconds: 3600,
		PlayedAt:        t1,
	})
	if err != nil {
		t.Fatalf("insert journey 1: %v", err)
	}

	j2, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          userID,
		IGDBID:          igdbID,
		StartedAt:       t2,
		EndedAt:         t2.Add(1800 * time.Second),
		DurationSeconds: 1800,
		PlayedAt:        t2,
	})
	if err != nil {
		t.Fatalf("insert journey 2: %v", err)
	}

	// 1. GetJourneyByID
	gotJ1, err := db.GetJourneyByID(ctx, pool, j1)
	if err != nil {
		t.Fatalf("get journey 1: %v", err)
	}
	if gotJ1.DurationSeconds != 3600 {
		t.Errorf("expected session duration 3600, got %d", gotJ1.DurationSeconds)
	}
	if gotJ1.TotalDurationSeconds != 5400 {
		t.Errorf("expected total duration 5400, got %d", gotJ1.TotalDurationSeconds)
	}

	// 2. ListJourneysByUser
	userJourneys, err := db.ListJourneysByUser(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("list journeys by user: %v", err)
	}
	if len(userJourneys) != 2 {
		t.Fatalf("expected 2 journeys, got %d", len(userJourneys))
	}
	for _, uj := range userJourneys {
		if uj.TotalDurationSeconds != 5400 {
			t.Errorf("journey %s: expected total duration 5400, got %d", uj.ID, uj.TotalDurationSeconds)
		}
	}

	// 3. ListJourneysByIGDBID
	gameJourneys, err := db.ListJourneysByIGDBID(ctx, pool, igdbID, 10, "")
	if err != nil {
		t.Fatalf("list journeys by igdb: %v", err)
	}
	if len(gameJourneys) != 2 {
		t.Fatalf("expected 2 game journeys, got %d", len(gameJourneys))
	}
	for _, gj := range gameJourneys {
		if gj.TotalDurationSeconds != 5400 {
			t.Errorf("game journey %s: expected total duration 5400, got %d", gj.JourneyID, gj.TotalDurationSeconds)
		}
	}

	// 4. GetUserGameStats
	stats, err := db.GetUserGameStats(ctx, pool, userID, igdbID)
	if err != nil {
		t.Fatalf("get user game stats: %v", err)
	}
	if stats == nil {
		t.Fatal("expected non-nil user game stats")
	}
	if stats.TotalSeconds != 5400 {
		t.Errorf("expected stats total seconds 5400, got %d", stats.TotalSeconds)
	}
	if stats.JourneyCount != 2 {
		t.Errorf("expected stats journey count 2, got %d", stats.JourneyCount)
	}
	if stats.FirstPlayed == nil || stats.FirstPlayed.Format(db.DateFormat) != t1.Format(db.DateFormat) {
		t.Errorf("expected first played %s, got %v", t1.Format(db.DateFormat), stats.FirstPlayed)
	}
	if stats.LastPlayed == nil || stats.LastPlayed.Format(db.DateFormat) != t2.Format(db.DateFormat) {
		t.Errorf("expected last played %s, got %v", t2.Format(db.DateFormat), stats.LastPlayed)
	}

	// 5. GetUserGameStats for unplayed game returns nil
	noStats, err := db.GetUserGameStats(ctx, pool, userID, 99999)
	if err != nil {
		t.Fatalf("get user game stats for unplayed game: %v", err)
	}
	if noStats != nil {
		t.Errorf("expected nil stats for unplayed game, got %+v", noStats)
	}

	_ = j2
}
