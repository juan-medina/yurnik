// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package profile

import (
	"testing"
	"time"

	"github.com/juan-medina/yurnik/internal/db"
)

func mkJourney(id string, playedAt time.Time) db.JourneyWithPlayer {
	return db.JourneyWithPlayer{ID: id, PlayedAt: playedAt}
}

func mkActivity(typ string, createdAt time.Time) db.ActivityEvent {
	return db.ActivityEvent{Type: typ, CreatedAt: createdAt}
}

func TestMergeFeedItems_interleavesByTime(t *testing.T) {
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	journeys := []db.JourneyWithPlayer{
		mkJourney("j1", now),                   // 12:00
		mkJourney("j2", now.Add(-2*time.Hour)), // 10:00
	}
	activity := []db.ActivityEvent{
		mkActivity("new_follower", now.Add(-1*time.Hour)), // 11:00
		mkActivity("new_comment", now.Add(-3*time.Hour)),  // 09:00
	}

	items, cursor := mergeFeedItems(journeys, activity, 10, "", "")

	if len(items) != 4 {
		t.Fatalf("expected 4 items, got %d", len(items))
	}
	wantKinds := []string{"journey", "activity", "journey", "activity"}
	for i, want := range wantKinds {
		if items[i].Kind != want {
			t.Errorf("item %d: got kind %q, want %q", i, items[i].Kind, want)
		}
	}
	if cursor != "" {
		t.Errorf("expected empty cursor when both sources exhausted, got %q", cursor)
	}
}

func TestMergeFeedItems_truncatesAndSetsNextCursor(t *testing.T) {
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	// 3 journeys (limit+1 = 3 fetched for limit=2), no activity.
	journeys := []db.JourneyWithPlayer{
		mkJourney("j1", now),
		mkJourney("j2", now.Add(-1*time.Hour)),
		mkJourney("j3", now.Add(-2*time.Hour)),
	}
	var activity []db.ActivityEvent

	items, cursor := mergeFeedItems(journeys, activity, 2, "", "")

	if len(items) != 2 {
		t.Fatalf("expected 2 items (truncated to limit), got %d", len(items))
	}
	if items[0].Journey.ID != "j1" || items[1].Journey.ID != "j2" {
		t.Fatalf("unexpected items: %+v", items)
	}
	wantJourneyCursor := now.Add(-1 * time.Hour).UTC().Format(time.RFC3339)
	wantCursor := wantJourneyCursor + "|"
	if cursor != wantCursor {
		t.Errorf("got cursor %q, want %q", cursor, wantCursor)
	}
}

func TestMergeFeedItems_oneSourceExhaustedKeepsItsCursor(t *testing.T) {
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	// Journeys exhausted (only 1, <= limit), activity has more (limit+1 = 3).
	journeys := []db.JourneyWithPlayer{
		mkJourney("j1", now.Add(-10*time.Hour)),
	}
	activity := []db.ActivityEvent{
		mkActivity("new_follower", now),
		mkActivity("new_comment", now.Add(-1*time.Hour)),
		mkActivity("new_follower", now.Add(-2*time.Hour)),
	}

	items, cursor := mergeFeedItems(journeys, activity, 2, "", "")

	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	for _, item := range items {
		if item.Kind != "activity" {
			t.Errorf("expected only activity items, got %+v", item)
		}
	}
	// Journey source contributed nothing this page; its cursor (empty/first
	// page) must be preserved so it isn't skipped on the next page.
	wantActivityCursor := now.Add(-1 * time.Hour).UTC().Format(time.RFC3339)
	wantCursor := "|" + wantActivityCursor
	if cursor != wantCursor {
		t.Errorf("got cursor %q, want %q", cursor, wantCursor)
	}
}

func TestMergeFeedItems_emptyResultNoCursor(t *testing.T) {
	items, cursor := mergeFeedItems(nil, nil, 10, "", "")
	if len(items) != 0 {
		t.Fatalf("expected no items, got %d", len(items))
	}
	if cursor != "" {
		t.Errorf("expected empty cursor, got %q", cursor)
	}
}
