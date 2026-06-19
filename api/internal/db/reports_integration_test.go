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

func TestListReports_OrderedMostRecentFirst_AndCursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	// Sweep any test reports left by a previous killed process. Scoped to
	// provider='test' so real reports from real users are never touched.
	if _, err := pool.Exec(ctx, `
		DELETE FROM reports r
		USING users u
		WHERE r.reporter_id = u.id AND u.provider = 'test'
	`); err != nil {
		t.Fatalf("pre-clean stale test reports: %v", err)
	}

	reporter := createTestUserNamed(t, pool, "-report-reporter")
	target := createTestUserNamed(t, pool, "-report-target")

	insertTestGame(t, pool, 77701, "Report Game A")
	journeyID, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          target,
		IGDBID:          77701,
		StartedAt:       time.Date(2026, 6, 10, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 10, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}

	c1, err := db.InsertComment(ctx, pool, journeyID, target, "first comment")
	if err != nil {
		t.Fatalf("insert comment 1: %v", err)
	}
	c2, err := db.InsertComment(ctx, pool, journeyID, target, "second comment")
	if err != nil {
		t.Fatalf("insert comment 2: %v", err)
	}
	c3, err := db.InsertComment(ctx, pool, journeyID, target, "third comment")
	if err != nil {
		t.Fatalf("insert comment 3: %v", err)
	}

	var insertedIDs []string
	for _, cid := range []string{c1.ID, c2.ID, c3.ID} {
		jid := journeyID
		id, ok, err := db.InsertReport(ctx, pool, reporter, "comment", cid, &jid, "spam", nil)
		if err != nil || !ok {
			t.Fatalf("insert report for comment %s: ok=%v err=%v", cid, ok, err)
		}
		insertedIDs = append(insertedIDs, id)
	}

	// Walk pages and collect only our 3 reports by ID. This isolates us from
	// any pre-existing reports in the shared DB while still exercising the
	// real cursor pagination path end-to-end.
	idSet := make(map[string]bool, len(insertedIDs))
	for _, id := range insertedIDs {
		idSet[id] = true
	}

	var found []db.Report
	cursor := ""
	var prevLastTime time.Time
	for {
		page, err := db.ListReports(ctx, pool, 2, cursor)
		if err != nil {
			t.Fatalf("list reports (cursor=%q): %v", cursor, err)
		}
		if len(page) == 0 {
			break
		}
		// Each page must be internally ordered DESC.
		for i := 1; i < len(page); i++ {
			if page[i-1].CreatedAt.Before(page[i].CreatedAt) {
				t.Fatalf("page not DESC at index %d: %v before %v", i, page[i-1].CreatedAt, page[i].CreatedAt)
			}
		}
		// The first item on every page after the first must be older than the
		// last item on the previous page (cursor continuity).
		if !prevLastTime.IsZero() && page[0].CreatedAt.After(prevLastTime) {
			t.Fatalf("cursor continuity broken: page first item %v is newer than prev last %v", page[0].CreatedAt, prevLastTime)
		}
		for _, r := range page {
			if idSet[r.ID] {
				found = append(found, r)
			}
		}
		if len(found) == len(insertedIDs) {
			break // all our reports located; no need to walk the whole table
		}
		prevLastTime = page[len(page)-1].CreatedAt
		cursor = db.EncodeReportCursor(page[len(page)-1].CreatedAt, page[len(page)-1].ID)
	}

	if len(found) != len(insertedIDs) {
		t.Fatalf("expected to find %d inserted reports across pages, found %d", len(insertedIDs), len(found))
	}
	// Our 3 reports must be in DESC order among themselves.
	for i := 1; i < len(found); i++ {
		if found[i-1].CreatedAt.Before(found[i].CreatedAt) {
			t.Fatalf("our reports not DESC at index %d", i)
		}
	}
}
