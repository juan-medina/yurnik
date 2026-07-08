// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

func insertTestGame(t *testing.T, pool *pgxpool.Pool, igdbID int, name string) {
	t.Helper()
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO igdb_games (igdb_id, name) VALUES ($1, $2)
		ON CONFLICT (igdb_id) DO NOTHING
	`, igdbID, name); err != nil {
		t.Fatalf("insert igdb_games: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = $1", igdbID) })
}

func TestAddBacklogEntry_IsIdempotent(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91001, "Test Game")

	added, err := db.AddBacklogEntry(ctx, pool, playerID, 91001)
	if err != nil {
		t.Fatalf("add backlog entry: %v", err)
	}
	if !added {
		t.Errorf("expected first add to report added=true")
	}

	added, err = db.AddBacklogEntry(ctx, pool, playerID, 91001)
	if err != nil {
		t.Fatalf("add backlog entry again: %v", err)
	}
	if added {
		t.Errorf("expected second add to report added=false")
	}
}

func TestRemoveBacklogEntry(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91002, "Test Game 2")

	if _, err := db.AddBacklogEntry(ctx, pool, playerID, 91002); err != nil {
		t.Fatalf("add backlog entry: %v", err)
	}
	if err := db.RemoveBacklogEntry(ctx, pool, playerID, 91002); err != nil {
		t.Fatalf("remove backlog entry: %v", err)
	}

	entries, err := db.ListBacklogEntries(ctx, pool, playerID)
	if err != nil {
		t.Fatalf("list backlog entries: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries after removal, got %d", len(entries))
	}
}

func TestListBacklogEntries_OrderedByPosition(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91003, "First Added Game")
	insertTestGame(t, pool, 91004, "Second Added Game")

	if _, err := db.AddBacklogEntry(ctx, pool, playerID, 91003); err != nil {
		t.Fatalf("add backlog entry 1: %v", err)
	}
	if _, err := db.AddBacklogEntry(ctx, pool, playerID, 91004); err != nil {
		t.Fatalf("add backlog entry 2: %v", err)
	}

	entries, err := db.ListBacklogEntries(ctx, pool, playerID)
	if err != nil {
		t.Fatalf("list backlog entries: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if entries[0].IGDBID != 91003 || entries[1].IGDBID != 91004 {
		t.Errorf("expected entries in position order (newly added last), got %d, %d", entries[0].IGDBID, entries[1].IGDBID)
	}
}

func TestReorderBacklogEntries(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91010, "First Game")
	insertTestGame(t, pool, 91011, "Second Game")
	insertTestGame(t, pool, 91012, "Third Game")

	for _, id := range []int{91010, 91011, 91012} {
		if _, err := db.AddBacklogEntry(ctx, pool, playerID, id); err != nil {
			t.Fatalf("add backlog entry %d: %v", id, err)
		}
	}

	if err := db.ReorderBacklogEntries(ctx, pool, playerID, []int{91012, 91010, 91011}); err != nil {
		t.Fatalf("reorder backlog entries: %v", err)
	}

	entries, err := db.ListBacklogEntries(ctx, pool, playerID)
	if err != nil {
		t.Fatalf("list backlog entries: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	if entries[0].IGDBID != 91012 || entries[1].IGDBID != 91010 || entries[2].IGDBID != 91011 {
		t.Errorf("expected reordered entries 91012, 91010, 91011, got %d, %d, %d", entries[0].IGDBID, entries[1].IGDBID, entries[2].IGDBID)
	}
}

func TestReorderBacklogEntries_Mismatch(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91013, "Lone Game")

	if _, err := db.AddBacklogEntry(ctx, pool, playerID, 91013); err != nil {
		t.Fatalf("add backlog entry: %v", err)
	}

	if err := db.ReorderBacklogEntries(ctx, pool, playerID, []int{91013, 99999}); !errors.Is(err, db.ErrBacklogOrderMismatch) {
		t.Errorf("expected ErrBacklogOrderMismatch, got %v", err)
	}
}

func TestIsInBacklog(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91005, "Maybe Game")

	in, err := db.IsInBacklog(ctx, pool, playerID, 91005)
	if err != nil {
		t.Fatalf("is in backlog: %v", err)
	}
	if in {
		t.Errorf("expected not in backlog before add")
	}

	if _, err := db.AddBacklogEntry(ctx, pool, playerID, 91005); err != nil {
		t.Fatalf("add backlog entry: %v", err)
	}

	in, err = db.IsInBacklog(ctx, pool, playerID, 91005)
	if err != nil {
		t.Fatalf("is in backlog after add: %v", err)
	}
	if !in {
		t.Errorf("expected in backlog after add")
	}
}

func TestRecordBacklogAdd_RoundTrip(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()
	playerID := createTestUser(t, pool)
	insertTestGame(t, pool, 91006, "Backlog Game")

	if err := db.RecordBacklogAdd(ctx, pool, playerID, 91006, "Backlog Game"); err != nil {
		t.Fatalf("record backlog add: %v", err)
	}

	events, err := db.GetUserActivity(ctx, pool, playerID, 10, "")
	if err != nil {
		t.Fatalf("get user activity: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	e := events[0]
	if e.Type != "backlog_add" {
		t.Errorf("expected type backlog_add, got %s", e.Type)
	}
	if e.ActorID != playerID || e.RecipientID != playerID {
		t.Errorf("expected self-directed event, got actor %s, recipient %s", e.ActorID, e.RecipientID)
	}
	if e.SubjectIGDBID == nil || *e.SubjectIGDBID != 91006 {
		t.Errorf("expected subject igdb id 91006, got %v", e.SubjectIGDBID)
	}
	if e.SubjectTitle == nil || *e.SubjectTitle != "Backlog Game" {
		t.Errorf("expected subject title 'Backlog Game', got %v", e.SubjectTitle)
	}
}
