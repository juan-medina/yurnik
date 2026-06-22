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

const maxMentionsPerCommentForTest = 10

// simulatePostCommentWithMentions mirrors the @mention side effects of
// journeys.Handler.postComment exactly (parse -> resolve -> insert comment ->
// insert mentions -> echo), so this test exercises the same db-layer
// sequence the HTTP handler runs.
func simulatePostCommentWithMentions(t *testing.T, ctx context.Context, pool *pgxpool.Pool, journeyID, actorID, text string) db.JourneyComment {
	t.Helper()
	comment, err := db.InsertComment(ctx, pool, journeyID, actorID, text)
	if err != nil {
		t.Fatalf("insert comment: %v", err)
	}

	tokens := db.ParseMentions(text, maxMentionsPerCommentForTest)
	resolved, err := db.ResolveMentions(ctx, pool, tokens)
	if err != nil {
		t.Fatalf("resolve mentions: %v", err)
	}
	if len(resolved) > 0 {
		mentionedUserIDs, err := db.InsertCommentMentions(ctx, pool, comment.ID, actorID, tokens, resolved)
		if err != nil {
			t.Fatalf("insert comment mentions: %v", err)
		}
		byComment, err := db.ListCommentMentions(ctx, pool, []string{comment.ID})
		if err != nil {
			t.Fatalf("list comment mentions: %v", err)
		}
		comment.Mentions = byComment[comment.ID]

		meta, err := db.GetJourneyMeta(ctx, pool, journeyID)
		if err != nil {
			t.Fatalf("get journey meta: %v", err)
		}
		for _, recipientID := range mentionedUserIDs {
			if err := db.UpsertMentionEcho(ctx, pool, recipientID, actorID, journeyID, meta.GameName); err != nil {
				t.Fatalf("upsert mention echo: %v", err)
			}
		}
	}
	return comment
}

func setupMentionJourney(t *testing.T, pool *pgxpool.Pool, ownerID string, igdbID int, name string) string {
	t.Helper()
	ctx := context.Background()
	insertTestGame(t, pool, igdbID, name)
	journey, err := db.InsertJourney(ctx, pool, db.Journey{
		UserID:          ownerID,
		IGDBID:          igdbID,
		StartedAt:       time.Date(2026, 6, 10, 10, 0, 0, 0, time.UTC),
		EndedAt:         time.Date(2026, 6, 10, 11, 0, 0, 0, time.UTC),
		DurationSeconds: 3600,
		PlayedAt:        time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}
	return journey
}

func TestMentions_BasicResolutionAndEcho(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerbasic")
	target := createTestUserNamed(t, pool, "mentiontargetbasic")
	journey := setupMentionJourney(t, pool, owner, 56001, "Basic Mention Game")

	targetHandle := getUserHandle(t, pool, target)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "hey @"+targetHandle+" check this out")

	if len(comment.Mentions) != 1 {
		t.Fatalf("len(comment.Mentions) = %d, want 1", len(comment.Mentions))
	}
	if comment.Mentions[0].UserID != target {
		t.Errorf("mentioned user = %s, want %s", comment.Mentions[0].UserID, target)
	}
	if comment.Mentions[0].Handle != targetHandle {
		t.Errorf("mentioned handle = %s, want %s", comment.Mentions[0].Handle, targetHandle)
	}

	echoes, err := db.ListEchoes(ctx, pool, target, 10, "")
	if err != nil {
		t.Fatalf("list echoes: %v", err)
	}
	if len(echoes) != 1 || echoes[0].Type != "new_mention" {
		t.Fatalf("target echoes = %+v, want one new_mention echo", echoes)
	}
}

func TestMentions_CaseInsensitiveResolution(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownercase")
	target := createTestUserNamed(t, pool, "mentiontargetcase")
	journey := setupMentionJourney(t, pool, owner, 56002, "Case Mention Game")

	targetHandle := getUserHandle(t, pool, target)
	shouted := "@" + upper(targetHandle)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "yo "+shouted+" gg")

	if len(comment.Mentions) != 1 || comment.Mentions[0].UserID != target {
		t.Fatalf("comment.Mentions = %+v, want one mention of %s", comment.Mentions, target)
	}
}

func TestMentions_UnknownHandleIsIgnored(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerunknown")
	journey := setupMentionJourney(t, pool, owner, 56003, "Unknown Mention Game")

	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "hey @nobodyhasthishandle this is fine")

	if len(comment.Mentions) != 0 {
		t.Fatalf("comment.Mentions = %+v, want none for an unknown handle", comment.Mentions)
	}
}

func TestMentions_SelfMentionIsSkippedAndNotEchoed(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerself")
	journey := setupMentionJourney(t, pool, owner, 56004, "Self Mention Game")

	ownerHandle := getUserHandle(t, pool, owner)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "@"+ownerHandle+" talking to myself")

	if len(comment.Mentions) != 0 {
		t.Fatalf("comment.Mentions = %+v, want none for a self-mention", comment.Mentions)
	}
	echoes, err := db.ListEchoes(ctx, pool, owner, 10, "")
	if err != nil {
		t.Fatalf("list echoes: %v", err)
	}
	if len(echoes) != 0 {
		t.Fatalf("owner echoes = %+v, want none from self-mentioning", echoes)
	}
}

func TestMentions_DuplicateHandleInSameCommentInsertsOnce(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerdup")
	target := createTestUserNamed(t, pool, "mentiontargetdup")
	journey := setupMentionJourney(t, pool, owner, 56005, "Duplicate Mention Game")

	targetHandle := getUserHandle(t, pool, target)
	// Mentioning the same person twice must not violate the
	// (comment_id, mentioned_user_id) primary key.
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "@"+targetHandle+" and also @"+targetHandle+" again")

	if len(comment.Mentions) != 1 {
		t.Fatalf("len(comment.Mentions) = %d, want 1 (deduplicated)", len(comment.Mentions))
	}

	echoes, err := db.ListEchoes(ctx, pool, target, 10, "")
	if err != nil {
		t.Fatalf("list echoes: %v", err)
	}
	if len(echoes) != 1 {
		t.Fatalf("target echoes = %+v, want exactly one echo, not one per occurrence", echoes)
	}
}

// TestMentions_HandleRenameReflectsImmediately is the scenario from the
// design discussion: a mention is resolved to a stable user_id, never to the
// handle text, so renaming the mentioned user's Discord handle after the
// comment was posted must show the *new* handle when the comment is read
// back — without rewriting the comment body.
func TestMentions_HandleRenameReflectsImmediately(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerrename")
	target := createTestUserNamed(t, pool, "mentiontargetrename")
	journey := setupMentionJourney(t, pool, owner, 56006, "Rename Mention Game")

	originalHandle := getUserHandle(t, pool, target)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "nice clip @"+originalHandle)
	if len(comment.Mentions) != 1 {
		t.Fatalf("len(comment.Mentions) = %d, want 1", len(comment.Mentions))
	}

	// Simulate the target renaming their Discord handle on a later login.
	newHandle := originalHandle + "renamed"
	if _, err := pool.Exec(ctx, `UPDATE users SET handle = $1 WHERE id = $2`, newHandle, target); err != nil {
		t.Fatalf("simulate handle rename: %v", err)
	}

	byComment, err := db.ListCommentMentions(ctx, pool, []string{comment.ID})
	if err != nil {
		t.Fatalf("list comment mentions after rename: %v", err)
	}
	mentions := byComment[comment.ID]
	if len(mentions) != 1 {
		t.Fatalf("mentions after rename = %+v, want 1", mentions)
	}
	if mentions[0].Handle != newHandle {
		t.Errorf("mention handle after rename = %s, want %s (the comment body itself is untouched)", mentions[0].Handle, newHandle)
	}

	// The stored comment body still contains the literal text typed at the
	// time — only the live-joined mention metadata reflects the rename.
	comments, err := db.ListComments(ctx, pool, journey, 10, "")
	if err != nil {
		t.Fatalf("list comments: %v", err)
	}
	if len(comments) != 1 || comments[0].Body != "nice clip @"+originalHandle {
		t.Fatalf("comment body changed after rename: %+v", comments)
	}
}

// TestMentions_MentionedUserDeletedCascadesAwayButCommentSurvives covers the
// "what if the mentioned person deletes their account" edge case: the
// comment_mentions row cascades away via its FK on mentioned_user_id, but
// the comment itself (posted by someone else) must remain intact — it just
// renders as if there had never been a mention there.
func TestMentions_MentionedUserDeletedCascadesAwayButCommentSurvives(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerdeleted")
	target := createTestUserNamed(t, pool, "mentiontargetdeleted")
	journey := setupMentionJourney(t, pool, owner, 56007, "Deleted Target Mention Game")

	targetHandle := getUserHandle(t, pool, target)
	commentText := "go say hi to @" + targetHandle
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, commentText)
	if len(comment.Mentions) != 1 {
		t.Fatalf("len(comment.Mentions) = %d, want 1 before deletion", len(comment.Mentions))
	}

	if err := db.DeleteUser(ctx, pool, target); err != nil {
		t.Fatalf("delete mentioned user: %v", err)
	}

	comments, err := db.ListComments(ctx, pool, journey, 10, "")
	if err != nil {
		t.Fatalf("list comments after target deleted: %v", err)
	}
	if len(comments) != 1 {
		t.Fatalf("comments after target deleted = %+v, want the comment to survive", comments)
	}
	if comments[0].Body != commentText {
		t.Errorf("comment body after target deleted = %q, want unchanged %q", comments[0].Body, commentText)
	}
	if len(comments[0].Mentions) != 0 {
		t.Errorf("comments[0].Mentions = %+v, want empty — the mention row cascaded away with the deleted user", comments[0].Mentions)
	}
}

// TestMentions_CommentAuthorDeletedRemovesTheirComment covers the reverse
// case: the person who *wrote* the mentioning comment deletes their
// account. comments.user_id cascades on delete, so the whole comment
// (and any mentions recorded against it) disappears — there is nothing left
// to render for anyone.
func TestMentions_CommentAuthorDeletedRemovesTheirComment(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownerauthorgone")
	commenter := createTestUserNamed(t, pool, "mentioncommenterauthorgone")
	target := createTestUserNamed(t, pool, "mentiontargetauthorgone")
	journey := setupMentionJourney(t, pool, owner, 56008, "Author Deleted Mention Game")

	targetHandle := getUserHandle(t, pool, target)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, commenter, "@"+targetHandle+" check this")
	if len(comment.Mentions) != 1 {
		t.Fatalf("len(comment.Mentions) = %d, want 1 before author deletion", len(comment.Mentions))
	}

	if err := db.DeleteUser(ctx, pool, commenter); err != nil {
		t.Fatalf("delete comment author: %v", err)
	}

	comments, err := db.ListComments(ctx, pool, journey, 10, "")
	if err != nil {
		t.Fatalf("list comments after author deleted: %v", err)
	}
	if len(comments) != 0 {
		t.Fatalf("comments after author deleted = %+v, want none — the comment cascades away with its author", comments)
	}

	// The mentioned target should not retain a dangling echo pointing at
	// content that no longer exists; the existing echo row is left as-is
	// (subject_title still resolves via journey, not the deleted comment),
	// but at minimum it must not error to read.
	if _, err := db.ListEchoes(ctx, pool, target, 10, ""); err != nil {
		t.Fatalf("list target echoes after author deleted: %v", err)
	}
}

func TestMentions_MultipleMentionsInOneCommentEachGetEchoed(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	owner := createTestUserNamed(t, pool, "mentionownermulti")
	targetA := createTestUserNamed(t, pool, "mentiontargetmultia")
	targetB := createTestUserNamed(t, pool, "mentiontargetmultib")
	journey := setupMentionJourney(t, pool, owner, 56009, "Multi Mention Game")

	handleA := getUserHandle(t, pool, targetA)
	handleB := getUserHandle(t, pool, targetB)
	comment := simulatePostCommentWithMentions(t, ctx, pool, journey, owner, "@"+handleA+" and @"+handleB+" should team up")

	if len(comment.Mentions) != 2 {
		t.Fatalf("len(comment.Mentions) = %d, want 2", len(comment.Mentions))
	}

	for _, target := range []string{targetA, targetB} {
		echoes, err := db.ListEchoes(ctx, pool, target, 10, "")
		if err != nil {
			t.Fatalf("list echoes for %s: %v", target, err)
		}
		if len(echoes) != 1 || echoes[0].Type != "new_mention" {
			t.Fatalf("echoes for %s = %+v, want one new_mention echo", target, echoes)
		}
	}
}

func getUserHandle(t *testing.T, pool *pgxpool.Pool, userID string) string {
	t.Helper()
	user, err := db.GetUser(context.Background(), pool, userID)
	if err != nil {
		t.Fatalf("get user %s: %v", userID, err)
	}
	return user.Handle
}

func upper(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - ('a' - 'A')
		}
	}
	return string(b)
}
