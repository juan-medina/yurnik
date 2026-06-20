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

func TestUpsertCommentReplyEcho(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	recipient := createTestUserNamed(t, pool, "-reply-recipient")
	actor1 := createTestUserNamed(t, pool, "-reply-actor1")
	actor2 := createTestUserNamed(t, pool, "-reply-actor2")

	insertTestGame(t, pool, 55503, "Reply Echo Game")
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
	if err := db.UpsertCommentReplyEcho(ctx, pool, recipient, recipient, journey, "Reply Echo Game"); err != nil {
		t.Fatalf("upsert reply echo self: %v", err)
	}

	if err := db.UpsertCommentReplyEcho(ctx, pool, recipient, actor1, journey, "Reply Echo Game"); err != nil {
		t.Fatalf("upsert reply echo 1: %v", err)
	}
	// A second commenter on the same journey batches into the same echo row.
	if err := db.UpsertCommentReplyEcho(ctx, pool, recipient, actor2, journey, "Reply Echo Game"); err != nil {
		t.Fatalf("upsert reply echo 2: %v", err)
	}

	echoes, err := db.ListEchoes(ctx, pool, recipient, 10, "")
	if err != nil {
		t.Fatalf("list echoes: %v", err)
	}
	if len(echoes) != 1 {
		t.Fatalf("len(echoes) = %d, want 1", len(echoes))
	}
	if echoes[0].Type != "new_comment_reply" {
		t.Fatalf("echo type = %s, want new_comment_reply", echoes[0].Type)
	}
	if echoes[0].ActorCount != 2 {
		t.Fatalf("actor count = %d, want 2", echoes[0].ActorCount)
	}
	if !echoes[0].Unread {
		t.Fatalf("echo should be unread")
	}
}

// simulatePostComment mirrors the echo side effects of journeys.Handler.postComment
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
	if err := db.UpsertCommentEcho(ctx, pool, meta.OwnerID, actorID, journeyID, meta.GameName); err != nil {
		t.Fatalf("upsert comment echo: %v", err)
	}
	priorCommenters, err := db.ListPriorCommenterIDs(ctx, pool, journeyID, actorID)
	if err != nil {
		t.Fatalf("list prior commenters: %v", err)
	}
	for _, recipientID := range priorCommenters {
		if recipientID == meta.OwnerID {
			continue
		}
		if err := db.UpsertCommentReplyEcho(ctx, pool, recipientID, actorID, journeyID, meta.GameName); err != nil {
			t.Fatalf("upsert reply echo: %v", err)
		}
	}
}

// TestCommentConversation_EchoFlow walks through a full back-and-forth conversation
// (owner's journey, a commenter, then repeated replies from both sides) and checks
// who gets notified — and who doesn't — at every step.
func TestCommentConversation_EchoFlow(t *testing.T) {
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

	// Step 1: owner creates the journey — no comments, no echoes for anyone yet.
	ownerEchoes, err := db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner echoes (step1): %v", err)
	}
	if len(ownerEchoes) != 0 {
		t.Fatalf("step1: owner echoes = %d, want 0", len(ownerEchoes))
	}

	// Step 2: commenter comments on the journey — owner gets new_comment,
	// commenter (the only prior commenter besides themselves) gets nothing.
	simulatePostComment(t, ctx, pool, journey, commenter)

	ownerEchoes, err = db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner echoes (step2): %v", err)
	}
	if len(ownerEchoes) != 1 || ownerEchoes[0].Type != "new_comment" || !ownerEchoes[0].Unread {
		t.Fatalf("step2: owner echoes = %+v, want one unread new_comment", ownerEchoes)
	}
	ownerEchoID := ownerEchoes[0].ID

	commenterEchoes, err := db.ListEchoes(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter echoes (step2): %v", err)
	}
	if len(commenterEchoes) != 0 {
		t.Fatalf("step2: commenter echoes = %d, want 0 (no one to notify them yet)", len(commenterEchoes))
	}

	// Step 3: owner replies — commenter gets new_comment_reply. Owner does not
	// get a new echo for commenting on their own journey.
	simulatePostComment(t, ctx, pool, journey, owner)

	commenterEchoes, err = db.ListEchoes(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter echoes (step3): %v", err)
	}
	if len(commenterEchoes) != 1 || commenterEchoes[0].Type != "new_comment_reply" || !commenterEchoes[0].Unread {
		t.Fatalf("step3: commenter echoes = %+v, want one unread new_comment_reply", commenterEchoes)
	}
	commenterEchoID := commenterEchoes[0].ID

	ownerEchoes, err = db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner echoes (step3): %v", err)
	}
	if len(ownerEchoes) != 1 || ownerEchoes[0].ID != ownerEchoID {
		t.Fatalf("step3: owner echoes = %+v, want unchanged single echo %d", ownerEchoes, ownerEchoID)
	}

	// Step 4: commenter comments again — owner's existing new_comment row is
	// refreshed (same id, same single actor). Commenter does not get a reply
	// echo for the owner's prior comment, since the owner already has their own.
	simulatePostComment(t, ctx, pool, journey, commenter)

	ownerEchoes, err = db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner echoes (step4): %v", err)
	}
	if len(ownerEchoes) != 1 || ownerEchoes[0].ID != ownerEchoID || ownerEchoes[0].ActorCount != 1 {
		t.Fatalf("step4: owner echoes = %+v, want same row refreshed with actor count 1", ownerEchoes)
	}

	commenterEchoes, err = db.ListEchoes(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter echoes (step4): %v", err)
	}
	if len(commenterEchoes) != 1 || commenterEchoes[0].ID != commenterEchoID {
		t.Fatalf("step4: commenter echoes = %+v, want unchanged single echo %d", commenterEchoes, commenterEchoID)
	}

	// Step 5: owner replies again — commenter's existing new_comment_reply row
	// is refreshed (same id, same single actor), not duplicated.
	simulatePostComment(t, ctx, pool, journey, owner)

	commenterEchoes, err = db.ListEchoes(ctx, pool, commenter, 10, "")
	if err != nil {
		t.Fatalf("list commenter echoes (step5): %v", err)
	}
	if len(commenterEchoes) != 1 || commenterEchoes[0].ID != commenterEchoID || commenterEchoes[0].ActorCount != 1 {
		t.Fatalf("step5: commenter echoes = %+v, want same row refreshed with actor count 1", commenterEchoes)
	}

	ownerEchoes, err = db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list owner echoes (step5): %v", err)
	}
	if len(ownerEchoes) != 1 || ownerEchoes[0].ID != ownerEchoID {
		t.Fatalf("step5: owner echoes = %+v, want unchanged single echo %d", ownerEchoes, ownerEchoID)
	}
}
