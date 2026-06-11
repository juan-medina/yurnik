// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// createTestUserNamed inserts a unique user for this test, distinguished by
// suffix so a single test can create multiple users.
func createTestUserNamed(t *testing.T, pool *pgxpool.Pool, suffix string) string {
	t.Helper()
	ctx := context.Background()
	var id string
	handle := strings.ToLower(strings.NewReplacer("/", "_", " ", "_").Replace(t.Name() + suffix))
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, $2, 'Test User')
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, t.Name()+suffix, handle).Scan(&id)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})
	return id
}

func TestRecordActivity_GetUserActivity_Follower(t *testing.T) {
	pool := connectTestDB(t)
	actorID := createTestUserNamed(t, pool, "-actor")
	targetID := createTestUserNamed(t, pool, "-target")

	if err := db.RecordActivity(context.Background(), pool, actorID, targetID, "new_follower", nil, nil); err != nil {
		t.Fatalf("record activity: %v", err)
	}

	events, err := db.GetUserActivity(context.Background(), pool, actorID, 10, "")
	if err != nil {
		t.Fatalf("get user activity: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	e := events[0]
	if e.Type != "new_follower" {
		t.Errorf("expected type new_follower, got %s", e.Type)
	}
	if e.ActorID != actorID {
		t.Errorf("expected actor %s, got %s", actorID, e.ActorID)
	}
	if e.RecipientID != targetID {
		t.Errorf("expected recipient %s, got %s", targetID, e.RecipientID)
	}
}

func TestGetFollowingActivity_ReturnsFollowedUsersActivity(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	follower := createTestUserNamed(t, pool, "-follower")
	actor := createTestUserNamed(t, pool, "-actor")
	target := createTestUserNamed(t, pool, "-target")

	if _, err := pool.Exec(ctx, `
		INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
	`, follower, actor); err != nil {
		t.Fatalf("insert follow: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", follower, actor)
	})

	if err := db.RecordActivity(ctx, pool, actor, target, "new_follower", nil, nil); err != nil {
		t.Fatalf("record activity: %v", err)
	}

	events, err := db.GetFollowingActivity(ctx, pool, follower, 10, "")
	if err != nil {
		t.Fatalf("get following activity: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].ActorID != actor {
		t.Errorf("expected actor %s, got %s", actor, events[0].ActorID)
	}
}

func TestGetUserActivity_SkipsCommentWithNilSubject(t *testing.T) {
	pool := connectTestDB(t)
	actorID := createTestUserNamed(t, pool, "-actor")
	targetID := createTestUserNamed(t, pool, "-target")

	if err := db.RecordActivity(context.Background(), pool, actorID, targetID, "new_comment", nil, nil); err != nil {
		t.Fatalf("record activity: %v", err)
	}

	events, err := db.GetUserActivity(context.Background(), pool, actorID, 10, "")
	if err != nil {
		t.Fatalf("get user activity: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected comment with nil subject to be skipped, got %d events", len(events))
	}
}

func TestGetUserActivity_CommentWithSubject(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	actorID := createTestUserNamed(t, pool, "-actor")
	targetID := createTestUserNamed(t, pool, "-target")

	if _, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name) VALUES (90001, 'Test Game')
		ON CONFLICT (igdb_id) DO NOTHING
	`); err != nil {
		t.Fatalf("insert igdb_games: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = 90001") })

	var journeyID string
	err := pool.QueryRow(ctx, `
		INSERT INTO journeys (user_id, igdb_id, started_at, ended_at, duration_seconds, played_at)
		VALUES ($1, 90001, now(), now(), 3600, now())
		RETURNING id
	`, targetID).Scan(&journeyID)
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM journeys WHERE id = $1", journeyID) })

	gameName := "Test Game"
	if err := db.RecordActivity(ctx, pool, actorID, targetID, "new_comment", &journeyID, &gameName); err != nil {
		t.Fatalf("record activity: %v", err)
	}

	events, err := db.GetUserActivity(ctx, pool, actorID, 10, "")
	if err != nil {
		t.Fatalf("get user activity: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	e := events[0]
	if e.Type != "new_comment" {
		t.Errorf("expected type new_comment, got %s", e.Type)
	}
	if e.SubjectID == nil || *e.SubjectID != journeyID {
		t.Errorf("expected subject id %s, got %v", journeyID, e.SubjectID)
	}
	if e.SubjectTitle == nil || *e.SubjectTitle != gameName {
		t.Errorf("expected subject title %s, got %v", gameName, e.SubjectTitle)
	}
}

func TestGetUserActivity_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	actorID := createTestUserNamed(t, pool, "-actor")
	targetID := createTestUserNamed(t, pool, "-target")

	base := time.Now().UTC().Add(-1 * time.Hour)
	for i := 0; i < 3; i++ {
		createdAt := base.Add(time.Duration(i) * time.Minute)
		if _, err := pool.Exec(ctx, `
			INSERT INTO activity_events (actor_id, target_id, type, created_at)
			VALUES ($1, $2, 'new_follower', $3)
		`, actorID, targetID, createdAt); err != nil {
			t.Fatalf("insert activity event %d: %v", i, err)
		}
	}

	first, err := db.GetUserActivity(ctx, pool, actorID, 2, "")
	if err != nil {
		t.Fatalf("get user activity (page 1): %v", err)
	}
	if len(first) != 2 {
		t.Fatalf("expected 2 events on first page, got %d", len(first))
	}

	cursor := first[len(first)-1].CreatedAt.UTC().Format(time.RFC3339)
	second, err := db.GetUserActivity(ctx, pool, actorID, 2, cursor)
	if err != nil {
		t.Fatalf("get user activity (page 2): %v", err)
	}
	if len(second) != 1 {
		t.Fatalf("expected 1 event on second page, got %d", len(second))
	}
	if second[0].CreatedAt.After(first[len(first)-1].CreatedAt) {
		t.Errorf("expected page 2 events to be older than page 1's last event")
	}
}
