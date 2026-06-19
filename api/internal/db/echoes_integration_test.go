// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/juan-medina/yurnik/internal/db"
)

func TestListEchoes_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	recipient := createTestUserNamed(t, pool, "-echo-recipient")
	actor1 := createTestUserNamed(t, pool, "-echo-actor1")
	actor2 := createTestUserNamed(t, pool, "-echo-actor2")
	actor3 := createTestUserNamed(t, pool, "-echo-actor3")

	insertTestGame(t, pool, 55501, "Echo Paging Game A")
	insertTestGame(t, pool, 55502, "Echo Paging Game B")

	journeyA, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          recipient,
		IGDBID:          55501,
		StartedAt:       time.Date(2026, 6, 10, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 10, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey A: %v", err)
	}
	journeyB, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          recipient,
		IGDBID:          55502,
		StartedAt:       time.Date(2026, 6, 11, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 11, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 11, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey B: %v", err)
	}

	// Three distinct echo rows: one follower echo, two comment echoes.
	if err := db.UpsertFollowerEcho(ctx, pool, recipient, actor1); err != nil {
		t.Fatalf("upsert follower echo: %v", err)
	}
	if err := db.UpsertCommentEcho(ctx, pool, recipient, actor2, journeyA, "Paging Game A"); err != nil {
		t.Fatalf("upsert comment echo A: %v", err)
	}
	if err := db.UpsertCommentEcho(ctx, pool, recipient, actor3, journeyB, "Paging Game B"); err != nil {
		t.Fatalf("upsert comment echo B: %v", err)
	}

	// Page 1: limit=2, no cursor — newest two echoes.
	page1, err := db.ListEchoes(ctx, pool, recipient, 2, "")
	if err != nil {
		t.Fatalf("page1: %v", err)
	}
	if len(page1) != 2 {
		t.Fatalf("page1 len = %d, want 2", len(page1))
	}

	// Page 2: cursor from last item on page 1 — remaining echo.
	cursor := db.EncodeEchoCursor(page1[1].UpdatedAt, page1[1].ID)
	page2, err := db.ListEchoes(ctx, pool, recipient, 2, cursor)
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if len(page2) != 1 {
		t.Fatalf("page2 len = %d, want 1", len(page2))
	}

	// Page 3: cursor from page 2's only item — should be empty.
	cursor2 := db.EncodeEchoCursor(page2[0].UpdatedAt, page2[0].ID)
	page3, err := db.ListEchoes(ctx, pool, recipient, 2, cursor2)
	if err != nil {
		t.Fatalf("page3: %v", err)
	}
	if len(page3) != 0 {
		t.Fatalf("page3 len = %d, want 0", len(page3))
	}
}
