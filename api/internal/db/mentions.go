// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// mentionPattern matches an "@handle" token. Discord handles are
// alphanumerics, underscore, and period.
var mentionPattern = regexp.MustCompile(`@[A-Za-z0-9_.]+`)

// MentionToken is a candidate "@handle" found in raw comment text, with its
// position expressed in runes so it survives multi-byte characters earlier
// in the string.
type MentionToken struct {
	Handle      string
	StartOffset int
	Length      int
}

// ParseMentions extracts up to maxMentions candidate "@handle" tokens from
// text. Tokens are not yet resolved against real users — that happens in
// ResolveMentions, since an "@handle" with no matching user is just inert
// text (same as Discord/Slack). Duplicate handles are kept (resolution dedups
// per-user, not per-token) so offsets stay accurate for every occurrence.
func ParseMentions(text string, maxMentions int) []MentionToken {
	var tokens []MentionToken
	for _, loc := range mentionPattern.FindAllStringIndex(text, -1) {
		if len(tokens) >= maxMentions {
			break
		}
		// Convert byte offsets (from FindAllStringIndex) to rune offsets.
		startRune := len([]rune(text[:loc[0]]))
		match := text[loc[0]:loc[1]]
		length := len([]rune(match))
		tokens = append(tokens, MentionToken{
			Handle:      match[1:], // drop leading "@"
			StartOffset: startRune,
			Length:      length,
		})
	}
	return tokens
}

// CommentMention is a resolved mention attached to a comment, with the
// mentioned user's current handle/name/avatar for rendering — looked up live
// at read time so a Discord handle rename is reflected immediately.
type CommentMention struct {
	UserID      string
	Handle      string
	Name        string
	StartOffset int
	Length      int
}

// ResolveMentions looks up the given candidate handles (case-insensitive,
// deduplicated) and returns the matching user IDs. Handles with no matching
// user are silently dropped.
func ResolveMentions(ctx context.Context, pool *pgxpool.Pool, tokens []MentionToken) (map[string]string, error) {
	if len(tokens) == 0 {
		return nil, nil
	}
	seen := map[string]bool{}
	handles := make([]string, 0, len(tokens))
	for _, tok := range tokens {
		key := strings.ToLower(tok.Handle)
		if seen[key] {
			continue
		}
		seen[key] = true
		handles = append(handles, key)
	}

	rows, err := pool.Query(ctx, `
		SELECT lower(handle), id FROM users WHERE lower(handle) = ANY($1)
	`, handles)
	if err != nil {
		return nil, fmt.Errorf("resolve mentions: %w", err)
	}
	defer rows.Close()

	resolved := map[string]string{}
	for rows.Next() {
		var handle, id string
		if err := rows.Scan(&handle, &id); err != nil {
			return nil, fmt.Errorf("scan resolved mention: %w", err)
		}
		resolved[handle] = id
	}
	return resolved, rows.Err()
}

// InsertCommentMentions writes the resolved mentions for a comment and
// returns the distinct mentioned user IDs that were recorded (for echo
// writes). A mention of the comment's own author is skipped — no
// self-mention record or echo.
func InsertCommentMentions(ctx context.Context, pool *pgxpool.Pool, commentID, authorID string, tokens []MentionToken, resolved map[string]string) ([]string, error) {
	type mention struct {
		userID      string
		startOffset int
		length      int
	}
	var mentions []mention
	seen := map[string]bool{}
	for _, tok := range tokens {
		userID, ok := resolved[strings.ToLower(tok.Handle)]
		if !ok || userID == authorID || seen[userID] {
			continue
		}
		seen[userID] = true
		mentions = append(mentions, mention{userID: userID, startOffset: tok.StartOffset, length: tok.Length})
	}
	if len(mentions) == 0 {
		return nil, nil
	}

	batch := &pgx.Batch{}
	for _, m := range mentions {
		batch.Queue(`
			INSERT INTO comment_mentions (comment_id, mentioned_user_id, start_offset, length)
			VALUES ($1, $2, $3, $4)
		`, commentID, m.userID, m.startOffset, m.length)
	}
	br := pool.SendBatch(ctx, batch)
	defer br.Close()
	for i := 0; i < len(mentions); i++ {
		if _, err := br.Exec(); err != nil {
			return nil, fmt.Errorf("insert comment mention: %w", err)
		}
	}
	if err := br.Close(); err != nil {
		return nil, fmt.Errorf("insert comment mention: %w", err)
	}

	userIDs := make([]string, len(mentions))
	for i, m := range mentions {
		userIDs[i] = m.userID
	}
	return userIDs, nil
}

// ListCommentMentions returns the resolved mentions for the given comment
// IDs, keyed by comment ID, joined with each mentioned user's current
// handle/name so rendering always reflects the latest Discord handle.
func ListCommentMentions(ctx context.Context, pool *pgxpool.Pool, commentIDs []string) (map[string][]CommentMention, error) {
	if len(commentIDs) == 0 {
		return nil, nil
	}
	rows, err := pool.Query(ctx, `
		SELECT cm.comment_id, cm.mentioned_user_id, cm.start_offset, cm.length,
		       u.handle, COALESCE(u.display_name, u.name)
		FROM comment_mentions cm
		JOIN users u ON u.id = cm.mentioned_user_id
		WHERE cm.comment_id = ANY($1)
	`, commentIDs)
	if err != nil {
		return nil, fmt.Errorf("list comment mentions: %w", err)
	}
	defer rows.Close()

	result := map[string][]CommentMention{}
	for rows.Next() {
		var commentID string
		var m CommentMention
		if err := rows.Scan(&commentID, &m.UserID, &m.StartOffset, &m.Length, &m.Handle, &m.Name); err != nil {
			return nil, fmt.Errorf("scan comment mention: %w", err)
		}
		result[commentID] = append(result[commentID], m)
	}
	return result, rows.Err()
}
