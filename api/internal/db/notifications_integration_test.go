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

func TestListNotifications_CursorPagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	recipient := createTestUserNamed(t, pool, "-notif-recipient")
	actor1 := createTestUserNamed(t, pool, "-notif-actor1")
	actor2 := createTestUserNamed(t, pool, "-notif-actor2")
	actor3 := createTestUserNamed(t, pool, "-notif-actor3")

	insertTestGame(t, pool, 55501, "Notif Paging Game A")
	insertTestGame(t, pool, 55502, "Notif Paging Game B")

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

	// Three distinct notification rows: one follower notification, two comment notifications.
	if err := db.UpsertFollowerNotification(ctx, pool, recipient, actor1); err != nil {
		t.Fatalf("upsert follower notification: %v", err)
	}
	if err := db.UpsertCommentNotification(ctx, pool, recipient, actor2, journeyA, "Paging Game A"); err != nil {
		t.Fatalf("upsert comment notification A: %v", err)
	}
	if err := db.UpsertCommentNotification(ctx, pool, recipient, actor3, journeyB, "Paging Game B"); err != nil {
		t.Fatalf("upsert comment notification B: %v", err)
	}

	// Page 1: limit=2, no cursor — newest two notifications.
	page1, err := db.ListNotifications(ctx, pool, recipient, 2, "")
	if err != nil {
		t.Fatalf("page1: %v", err)
	}
	if len(page1) != 2 {
		t.Fatalf("page1 len = %d, want 2", len(page1))
	}

	// Page 2: cursor from last item on page 1 — remaining notification.
	cursor := db.EncodeNotificationCursor(page1[1].UpdatedAt, page1[1].ID)
	page2, err := db.ListNotifications(ctx, pool, recipient, 2, cursor)
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if len(page2) != 1 {
		t.Fatalf("page2 len = %d, want 1", len(page2))
	}

	// Page 3: cursor from page 2's only item — should be empty.
	cursor2 := db.EncodeNotificationCursor(page2[0].UpdatedAt, page2[0].ID)
	page3, err := db.ListNotifications(ctx, pool, recipient, 2, cursor2)
	if err != nil {
		t.Fatalf("page3: %v", err)
	}
	if len(page3) != 0 {
		t.Fatalf("page3 len = %d, want 0", len(page3))
	}
}

func TestUpsertCommentReplyNotification(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	recipient := createTestUserNamed(t, pool, "-reply-recipient")
	actor1 := createTestUserNamed(t, pool, "-reply-actor1")
	actor2 := createTestUserNamed(t, pool, "-reply-actor2")

	insertTestGame(t, pool, 55503, "Reply Notif Game")
	journey, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          recipient,
		IGDBID:          55503,
		StartedAt:       time.Date(2026, 6, 10, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 10, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}

	// No-op when the recipient is the actor (commenting on your own prior comment).
	if err := db.UpsertCommentReplyNotification(ctx, pool, recipient, recipient, journey, "Reply Notif Game"); err != nil {
		t.Fatalf("upsert reply notification self: %v", err)
	}

	if err := db.UpsertCommentReplyNotification(ctx, pool, recipient, actor1, journey, "Reply Notif Game"); err != nil {
		t.Fatalf("upsert reply notification 1: %v", err)
	}
	// A second commenter on the same journey batches into the same notification row.
	if err := db.UpsertCommentReplyNotification(ctx, pool, recipient, actor2, journey, "Reply Notif Game"); err != nil {
		t.Fatalf("upsert reply notification 2: %v", err)
	}

	notifications, err := db.ListNotifications(ctx, pool, recipient, 10, "")
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	if len(notifications) != 1 {
		t.Fatalf("len(notifications) = %d, want 1", len(notifications))
	}
	if notifications[0].Type != "new_comment_reply" {
		t.Fatalf("notification type = %s, want new_comment_reply", notifications[0].Type)
	}
	if notifications[0].ActorCount != 2 {
		t.Fatalf("actor count = %d, want 2", notifications[0].ActorCount)
	}
	if !notifications[0].Unread {
		t.Fatalf("notification should be unread")
	}
}

// simulatePostComment mirrors the notification side effects of journeys.Handler.postComment
// exactly, so this test exercises the same db-layer sequence the HTTP handler runs.
func simulatePostComment(t *testing.T, ctx context.Context, pool *pgxpool.Pool, journeyID, actorID string) {
	t.Helper()
	if _, err := db.InsertComment(ctx, pool, journeyID, actorID, "test comment"); err != nil {
		t.Fatalf("insert comment: %v", err)
	}
	meta, err := db.GetJourneyMeta(ctx, pool, journeyID)
	if err != nil {
		t.Fatalf("get journey meta: %v", err)
	}
	if err := db.UpsertCommentNotification(ctx, pool, meta.OwnerID, actorID, journeyID, meta.GameName); err != nil {
		t.Fatalf("upsert comment notification: %v", err)
	}
	priorCommenters, err := db.ListPriorCommenterIDs(ctx, pool, journeyID, actorID)
	if err != nil {
		t.Fatalf("list prior commenters: %v", err)
	}
	for _, recipientID := range priorCommenters {
		if recipientID == meta.OwnerID {
			continue
		}
		if err := db.UpsertCommentReplyNotification(ctx, pool, recipientID, actorID, journeyID, meta.GameName); err != nil {
			t.Fatalf("upsert reply notification: %v", err)
		}
	}
}

// TestCommentConversation_NotificationFlow walks through a full back-and-forth conversation
// (owner's journey, a commenter, then repeated replies from both sides) and checks
// who gets notified — and who doesn't — at every step.
func TestCommentConversation_NotificationFlow(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "-conv-owner")
	commenter := createTestUserNamed(t, pool, "-conv-commenter")

	insertTestGame(t, pool, 55510, "Conversation Game")
	journey, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          owner,
		IGDBID:          55510,
		StartedAt:       time.Date(2026, 6, 10, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 10, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}

	// Step 1: owner creates the journey — no comments, no notifications for anyone yet.
	ownerNotifications, err := db.ListNotifications(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner notifications (step1): %v", err)
	}
	if len(ownerNotifications) != 0 {
		t.Fatalf("step1: owner notifications = %d, want 0", len(ownerNotifications))
	}

	// Step 2: commenter comments on the journey — owner gets new_comment,
	// commenter (the only prior commenter besides themselves) gets nothing.
	simulatePostComment(t, ctx, pool, journey, commenter)

	ownerNotifications, err = db.ListNotifications(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner notifications (step2): %v", err)
	}
	if len(ownerNotifications) != 1 || ownerNotifications[0].Type != "new_comment" || !ownerNotifications[0].Unread {
		t.Fatalf("step2: owner notifications = %+v, want one unread new_comment", ownerNotifications)
	}
	ownerNotifID := ownerNotifications[0].ID

	commenterNotifications, err := db.ListNotifications(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter notifications (step2): %v", err)
	}
	if len(commenterNotifications) != 0 {
		t.Fatalf("step2: commenter notifications = %d, want 0 (no one to notify them yet)", len(commenterNotifications))
	}

	// Step 3: owner replies — commenter gets new_comment_reply. Owner does not
	// get a new notification for commenting on their own journey.
	simulatePostComment(t, ctx, pool, journey, owner)

	commenterNotifications, err = db.ListNotifications(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter notifications (step3): %v", err)
	}
	if len(commenterNotifications) != 1 || commenterNotifications[0].Type != "new_comment_reply" || !commenterNotifications[0].Unread {
		t.Fatalf("step3: commenter notifications = %+v, want one unread new_comment_reply", commenterNotifications)
	}
	commenterNotifID := commenterNotifications[0].ID

	ownerNotifications, err = db.ListNotifications(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner notifications (step3): %v", err)
	}
	if len(ownerNotifications) != 1 || ownerNotifications[0].ID != ownerNotifID {
		t.Fatalf("step3: owner notifications = %+v, want unchanged single notification %d", ownerNotifications, ownerNotifID)
	}

	// Step 4: commenter comments again — owner's existing new_comment row is
	// refreshed (same id, same single actor). Commenter does not get a reply
	// notification for the owner's prior comment, since the owner already has their own.
	simulatePostComment(t, ctx, pool, journey, commenter)

	ownerNotifications, err = db.ListNotifications(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner notifications (step4): %v", err)
	}
	if len(ownerNotifications) != 1 || ownerNotifications[0].ID != ownerNotifID || ownerNotifications[0].ActorCount != 1 {
		t.Fatalf("step4: owner notifications = %+v, want same row refreshed with actor count 1", ownerNotifications)
	}

	commenterNotifications, err = db.ListNotifications(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter notifications (step4): %v", err)
	}
	if len(commenterNotifications) != 1 || commenterNotifications[0].ID != commenterNotifID {
		t.Fatalf("step4: commenter notifications = %+v, want unchanged single notification %d", commenterNotifications, commenterNotifID)
	}

	// Step 5: owner replies again — commenter's existing new_comment_reply row
	// is refreshed (same id, same single actor), not duplicated.
	simulatePostComment(t, ctx, pool, journey, owner)

	commenterNotifications, err = db.ListNotifications(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter notifications (step5): %v", err)
	}
	if len(commenterNotifications) != 1 || commenterNotifications[0].ID != commenterNotifID || commenterNotifications[0].ActorCount != 1 {
		t.Fatalf("step5: commenter notifications = %+v, want same row refreshed with actor count 1", commenterNotifications)
	}

	ownerNotifications, err = db.ListNotifications(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner notifications (step5): %v", err)
	}
	if len(ownerNotifications) != 1 || ownerNotifications[0].ID != ownerNotifID {
		t.Fatalf("step5: owner notifications = %+v, want unchanged single notification %d", ownerNotifications, ownerNotifID)
	}
}

func TestNotificationBatchWindows(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	recipient := createTestUserNamed(t, pool, "-batch-recipient")
	actor1 := createTestUserNamed(t, pool, "-batch-actor1")
	actor2 := createTestUserNamed(t, pool, "-batch-actor2")

	insertTestGame(t, pool, 55520, "Batch Game")
	journey, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          recipient,
		IGDBID:          55520,
		StartedAt:       time.Now().Add(-48 * time.Hour),
		EndedAt:         time.Now().Add(-47 * time.Hour),
		DurationSeconds: 3600,
		PlayedAt:        time.Now().Add(-48 * time.Hour),
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}

	// 1. Initial comment by actor1
	if err := db.UpsertCommentNotification(ctx, pool, recipient, actor1, journey, "Batch Game"); err != nil {
		t.Fatalf("upsert 1: %v", err)
	}

	// Read the notification to verify it's created and actor count is 1
	notifications, _ := db.ListNotifications(ctx, pool, recipient, 10, "")
	if len(notifications) != 1 || notifications[0].ActorCount != 1 {
		t.Fatalf("expected 1 notification with 1 actor, got: %+v", notifications)
	}
	firstNotifID := notifications[0].ID

	// 2. Second comment by actor2 immediately - should batch!
	if err := db.UpsertCommentNotification(ctx, pool, recipient, actor2, journey, "Batch Game"); err != nil {
		t.Fatalf("upsert 2: %v", err)
	}

	notifications, _ = db.ListNotifications(ctx, pool, recipient, 10, "")
	if len(notifications) != 1 || notifications[0].ID != firstNotifID || notifications[0].ActorCount != 2 {
		t.Fatalf("expected still 1 notification with 2 actors, got: %+v", notifications)
	}

	// 3. Manually push batch_until into the past to simulate time passing > 24 hours
	_, err = pool.Exec(ctx, "UPDATE notifications SET batch_until = now() - interval '1 second' WHERE id = $1", firstNotifID)
	if err != nil {
		t.Fatalf("update batch_until: %v", err)
	}

	// 4. Third comment by actor1 AFTER 24 hours window closed - should create NEW notification
	if err := db.UpsertCommentNotification(ctx, pool, recipient, actor1, journey, "Batch Game"); err != nil {
		t.Fatalf("upsert 3: %v", err)
	}

	notifications, _ = db.ListNotifications(ctx, pool, recipient, 10, "")
	if len(notifications) != 2 {
		t.Fatalf("expected 2 distinct notifications after time window expired, got %d", len(notifications))
	}
	
	// The newest notification should be first, with actor count 1 (actor1)
	if notifications[0].ID == firstNotifID {
		t.Fatalf("new notification was not created, still updating the old one")
	}
	if notifications[0].ActorCount != 1 {
		t.Fatalf("new notification should have 1 actor, got %d", notifications[0].ActorCount)
	}
}
