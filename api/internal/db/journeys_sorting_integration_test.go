// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// insertJourneyRaw inserts a journey row with explicit played_at and
// created_at values, bypassing InsertJourney's now()-based defaults so
// ordering tests can control both precisely.
func insertJourneyRaw(t *testing.T, pool *pgxpool.Pool, userID string, igdbID int, playedAt, createdAt time.Time) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO journeys (user_id, igdb_id, started_at, ended_at, duration_seconds, played_at, created_at)
		VALUES ($1, $2, $3, $3, 3600, $4, $3)
		RETURNING id
	`, userID, igdbID, createdAt, playedAt).Scan(&id)
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}
	return id
}

func TestInsertJourney_UpdateJourney_PlayedAtRoundTrip(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userID := createTestUser(t, pool)
	insertTestGame(t, pool, 90200, "Round Trip Game")

	endedAt := time.Now().UTC()
	playedAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	id, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          userID,
		IGDBID:          90200,
		StartedAt:       endedAt.Add(-time.Hour),
		EndedAt:         endedAt,
		DurationSeconds: 3600,
		PlayedAt:        playedAt,
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}

	got, err := db.GetJourneyByID(ctx, pool, id)
	if err != nil {
		t.Fatalf("get journey: %v", err)
	}
	if got.PlayedAt.Format(db.DateFormat) != "2026-01-01" {
		t.Errorf("played_at = %s, want 2026-01-01", got.PlayedAt.Format(db.DateFormat))
	}

	// Editing changes both the date and the duration independently.
	newPlayedAt := time.Date(2025, 12, 25, 0, 0, 0, 0, time.UTC)
	if err := db.UpdateJourney(ctx, pool, id, userID, 90200, 7200, endedAt, newPlayedAt, nil); err != nil {
		t.Fatalf("update journey: %v", err)
	}

	got, err = db.GetJourneyByID(ctx, pool, id)
	if err != nil {
		t.Fatalf("get journey after update: %v", err)
	}
	if got.PlayedAt.Format(db.DateFormat) != "2025-12-25" {
		t.Errorf("played_at after update = %s, want 2025-12-25", got.PlayedAt.Format(db.DateFormat))
	}
	if got.DurationSeconds != 7200 {
		t.Errorf("duration_seconds after update = %d, want 7200", got.DurationSeconds)
	}
}

func TestListJourneysByUser_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userID := createTestUser(t, pool)
	insertTestGame(t, pool, 90201, "Pagination Game")

	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	base := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)

	id1 := insertJourneyRaw(t, pool, userID, 90201, day, base)
	id2 := insertJourneyRaw(t, pool, userID, 90201, day, base.Add(1*time.Hour))
	id3 := insertJourneyRaw(t, pool, userID, 90201, day.AddDate(0, 0, -1), base.Add(-24*time.Hour))

	page1, err := db.ListJourneysByUser(ctx, pool, userID, 2, "")
	if err != nil {
		t.Fatalf("list page1: %v", err)
	}
	if len(page1) != 2 || page1[0].ID != id2 || page1[1].ID != id1 {
		t.Fatalf("page1 = [%s, %s], want [%s, %s]", page1[0].ID, page1[1].ID, id2, id1)
	}

	cursor := db.EncodeJourneyCursor(page1[1].PlayedAt, page1[1].CreatedAt)
	page2, err := db.ListJourneysByUser(ctx, pool, userID, 2, cursor)
	if err != nil {
		t.Fatalf("list page2: %v", err)
	}
	if len(page2) != 1 || page2[0].ID != id3 {
		t.Fatalf("page2 = [%v], want [%s]", page2, id3)
	}
}

func TestListOthersOnJourney_SameDayTiebreaksByCreatedAt(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	owner := createTestUserNamed(t, pool, "-owner")
	other1 := createTestUserNamed(t, pool, "-other1")
	other2 := createTestUserNamed(t, pool, "-other2")
	insertTestGame(t, pool, 90202, "Others Game")

	day := time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC)
	ownerJourneyID := insertJourneyRaw(t, pool, owner, 90202, day, day.Add(8*time.Hour))
	other1ID := insertJourneyRaw(t, pool, other1, 90202, day, day.Add(9*time.Hour))
	other2ID := insertJourneyRaw(t, pool, other2, 90202, day, day.Add(10*time.Hour))

	players, err := db.ListOthersOnJourney(ctx, pool, ownerJourneyID)
	if err != nil {
		t.Fatalf("list others on journey: %v", err)
	}
	if len(players) != 2 {
		t.Fatalf("expected 2 other players, got %d", len(players))
	}
	// Same played_at — most recently created sorts first.
	if players[0].JourneyID != other2ID || players[1].JourneyID != other1ID {
		t.Fatalf("got [%s, %s], want [%s, %s]", players[0].JourneyID, players[1].JourneyID, other2ID, other1ID)
	}
}

func TestListJourneysByIGDBID_OrdersByPlayedAtThenCreatedAt(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userA := createTestUserNamed(t, pool, "-igdb-a")
	userB := createTestUserNamed(t, pool, "-igdb-b")
	insertTestGame(t, pool, 90203, "IGDB Order Game")

	dayLater := time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC)
	dayEarlier := dayLater.AddDate(0, 0, -1)

	idA := insertJourneyRaw(t, pool, userA, 90203, dayEarlier, dayEarlier.Add(time.Hour))
	idB := insertJourneyRaw(t, pool, userB, 90203, dayLater, dayLater.Add(time.Hour))

	players, err := db.ListJourneysByIGDBID(ctx, pool, 90203, 20, "")
	if err != nil {
		t.Fatalf("list journeys by igdb id: %v", err)
	}
	if len(players) != 2 || players[0].JourneyID != idB || players[1].JourneyID != idA {
		t.Fatalf("got [%s, %s], want [%s, %s]", players[0].JourneyID, players[1].JourneyID, idB, idA)
	}
}

func TestListJourneysByIGDBID_AllJourneysFromSamePlayerReturned(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userID := createTestUserNamed(t, pool, "-multi")
	insertTestGame(t, pool, 90204, "Multi-Session Game")

	day := time.Date(2026, 6, 4, 0, 0, 0, 0, time.UTC)
	older := insertJourneyRaw(t, pool, userID, 90204, day, day.Add(8*time.Hour))
	newer := insertJourneyRaw(t, pool, userID, 90204, day, day.Add(9*time.Hour))

	players, err := db.ListJourneysByIGDBID(ctx, pool, 90204, 20, "")
	if err != nil {
		t.Fatalf("list journeys by igdb id: %v", err)
	}
	// Both sessions must appear — deduplication was the bug.
	if len(players) != 2 {
		t.Fatalf("expected 2 journeys (one per session), got %d", len(players))
	}
	// Newest first.
	if players[0].JourneyID != newer || players[1].JourneyID != older {
		t.Fatalf("got [%s, %s], want [%s, %s]", players[0].JourneyID, players[1].JourneyID, newer, older)
	}
}

func TestListJourneysByIGDBID_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userA := createTestUserNamed(t, pool, "-page-a")
	userB := createTestUserNamed(t, pool, "-page-b")
	insertTestGame(t, pool, 90207, "Paged Game")

	day := time.Date(2026, 6, 7, 0, 0, 0, 0, time.UTC)
	id1 := insertJourneyRaw(t, pool, userA, 90207, day, day.Add(8*time.Hour))
	id2 := insertJourneyRaw(t, pool, userA, 90207, day, day.Add(9*time.Hour))
	id3 := insertJourneyRaw(t, pool, userB, 90207, day, day.Add(10*time.Hour))

	page1, err := db.ListJourneysByIGDBID(ctx, pool, 90207, 2, "")
	if err != nil {
		t.Fatalf("list page1: %v", err)
	}
	if len(page1) != 2 || page1[0].JourneyID != id3 || page1[1].JourneyID != id2 {
		t.Fatalf("page1 = [%s, %s], want [%s, %s]", page1[0].JourneyID, page1[1].JourneyID, id3, id2)
	}

	cursor := db.EncodeJourneyCursor(page1[1].PlayedAt, page1[1].CreatedAt)
	page2, err := db.ListJourneysByIGDBID(ctx, pool, 90207, 2, cursor)
	if err != nil {
		t.Fatalf("list page2: %v", err)
	}
	if len(page2) != 1 || page2[0].JourneyID != id1 {
		t.Fatalf("page2 = %v, want [%s]", page2, id1)
	}
}

func TestGetGameActivity_OrdersEntriesByPlayedAtThenCreatedAt(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	userA := createTestUserNamed(t, pool, "-activity-a")
	userB := createTestUserNamed(t, pool, "-activity-b")
	insertTestGame(t, pool, 90205, "Activity Order Game")

	// Far-future date guarantees this game ranks first (by last_played) and
	// is therefore included in the diversity-capped top 12.
	day := time.Date(2099, 6, 5, 0, 0, 0, 0, time.UTC)
	idA := insertJourneyRaw(t, pool, userA, 90205, day, day.Add(8*time.Hour))
	idB := insertJourneyRaw(t, pool, userB, 90205, day, day.Add(9*time.Hour))

	entries, err := db.GetGameActivity(ctx, pool)
	if err != nil {
		t.Fatalf("get game activity: %v", err)
	}

	var gameEntries []db.ActivityEntry
	for _, e := range entries {
		if e.IGDBID == 90205 {
			gameEntries = append(gameEntries, e)
		}
	}
	if len(gameEntries) != 2 || gameEntries[0].SessionID != idB || gameEntries[1].SessionID != idA {
		t.Fatalf("got %v, want entries ordered [%s, %s]", gameEntries, idB, idA)
	}
}

func TestGetFollowingFeed_SameDayTiebreaksByCreatedAt_AndCursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	follower := createTestUserNamed(t, pool, "-follower")
	followee := createTestUserNamed(t, pool, "-followee")
	insertTestGame(t, pool, 90206, "Following Feed Game")

	if _, err := pool.Exec(ctx, `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)`, follower, followee); err != nil {
		t.Fatalf("insert follow: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", follower, followee)
	})

	day := time.Date(2026, 6, 6, 0, 0, 0, 0, time.UTC)
	id1 := insertJourneyRaw(t, pool, followee, 90206, day, day.Add(8*time.Hour))
	id2 := insertJourneyRaw(t, pool, followee, 90206, day, day.Add(9*time.Hour))
	id3 := insertJourneyRaw(t, pool, followee, 90206, day.AddDate(0, 0, -1), day.Add(-15*time.Hour))

	page1, err := db.GetFollowingFeed(ctx, pool, follower, 2, "")
	if err != nil {
		t.Fatalf("get following feed page1: %v", err)
	}
	if len(page1) != 2 || page1[0].ID != id2 || page1[1].ID != id1 {
		t.Fatalf("page1 = [%s, %s], want [%s, %s]", page1[0].ID, page1[1].ID, id2, id1)
	}

	cursor := db.EncodeJourneyCursor(page1[1].PlayedAt, page1[1].CreatedAt)
	page2, err := db.GetFollowingFeed(ctx, pool, follower, 2, cursor)
	if err != nil {
		t.Fatalf("get following feed page2: %v", err)
	}
	if len(page2) != 1 || page2[0].ID != id3 {
		t.Fatalf("page2 = %v, want [%s]", page2, id3)
	}
}
