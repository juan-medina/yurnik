// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ActivityEvent is a "X followed Y", "X commented on Y's <game> journey", or
// "X added <game> to their Backlog" event, where X (the actor) is followed by
// the viewer (the recipient).
type ActivityEvent struct {
	Type          string // "new_comment" | "new_follower" | "backlog_add"
	SubjectID     *string
	SubjectTitle  *string
	SubjectIGDBID *int
	CreatedAt     time.Time

	ActorID        string
	ActorHandle    string
	ActorName      string
	ActorAvatarURL *string
	ActorColor     string

	RecipientID        string
	RecipientHandle    string
	RecipientName      string
	RecipientAvatarURL *string
	RecipientColor     string
}

// RecordActivity inserts a row into activity_events for the Feed/Profile
// activity feeds. targetID is the player the action concerns (the journey
// owner for new_comment, the followee for new_follower). commentID is set
// for new_comment events so the row is removed automatically (ON DELETE
// CASCADE) if the comment is deleted; it is nil for other event types.
func RecordActivity(ctx context.Context, pool *pgxpool.Pool, actorID, targetID, eventType string, subjectID, subjectTitle, commentID *string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO activity_events (actor_id, target_id, type, subject_id, subject_title, comment_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, actorID, targetID, eventType, subjectID, subjectTitle, commentID)
	if err != nil {
		return fmt.Errorf("record activity: %w", err)
	}
	return nil
}

// RecordBacklogAdd inserts a backlog_add row into activity_events for the
// Feed/Profile activity feeds. The actor and target are the same player —
// adding a game to your Backlog is self-directed and never generates a
// Notification.
func RecordBacklogAdd(ctx context.Context, pool *pgxpool.Pool, actorID string, igdbID int, gameName string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO activity_events (actor_id, target_id, type, subject_igdb_id, subject_title)
		VALUES ($1, $1, 'backlog_add', $2, $3)
	`, actorID, igdbID, gameName)
	if err != nil {
		return fmt.Errorf("record backlog add: %w", err)
	}
	return nil
}

// GetFollowingActivity returns follow/comment events performed by users that
// userID follows, ordered by created_at descending with optional cursor
// pagination. Activity for journeys that have since been deleted (subject_id
// is NULL for new_comment) is omitted.
func GetFollowingActivity(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]ActivityEvent, error) {
	const cols = `
		ae.type, ae.subject_id, ae.subject_title, ae.subject_igdb_id, ae.created_at,
		a.id, a.handle, COALESCE(a.display_name, a.name), COALESCE(a.custom_avatar_url, a.avatar_url), a.color,
		t.id, t.handle, COALESCE(t.display_name, t.name), COALESCE(t.custom_avatar_url, t.avatar_url), t.color`

	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM activity_events ae
			JOIN follows f ON f.followee_id = ae.actor_id
			JOIN users a ON a.id = ae.actor_id
			JOIN users t ON t.id = ae.target_id
			WHERE f.follower_id = $1
			ORDER BY ae.created_at DESC
			LIMIT $2
		`, userID, limit)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM activity_events ae
			JOIN follows f ON f.followee_id = ae.actor_id
			JOIN users a ON a.id = ae.actor_id
			JOIN users t ON t.id = ae.target_id
			WHERE f.follower_id = $1 AND ae.created_at < $2
			ORDER BY ae.created_at DESC
			LIMIT $3
		`, userID, cursor, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("get following activity: %w", err)
	}
	defer rows.Close()

	var events []ActivityEvent
	for rows.Next() {
		var e ActivityEvent
		if err := rows.Scan(
			&e.Type, &e.SubjectID, &e.SubjectTitle, &e.SubjectIGDBID, &e.CreatedAt,
			&e.ActorID, &e.ActorHandle, &e.ActorName, &e.ActorAvatarURL, &e.ActorColor,
			&e.RecipientID, &e.RecipientHandle, &e.RecipientName, &e.RecipientAvatarURL, &e.RecipientColor,
		); err != nil {
			return nil, fmt.Errorf("scan activity event: %w", err)
		}
		if e.Type == "new_comment" && e.SubjectID == nil {
			continue
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// GetUserActivity returns follow/comment events performed by userID
// (regardless of who follows whom), ordered by created_at descending with
// optional cursor pagination. Activity for journeys that have since been
// deleted (subject_id is NULL for new_comment) is omitted.
func GetUserActivity(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]ActivityEvent, error) {
	const cols = `
		ae.type, ae.subject_id, ae.subject_title, ae.subject_igdb_id, ae.created_at,
		a.id, a.handle, COALESCE(a.display_name, a.name), COALESCE(a.custom_avatar_url, a.avatar_url), a.color,
		t.id, t.handle, COALESCE(t.display_name, t.name), COALESCE(t.custom_avatar_url, t.avatar_url), t.color`

	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM activity_events ae
			JOIN users a ON a.id = ae.actor_id
			JOIN users t ON t.id = ae.target_id
			WHERE ae.actor_id = $1
			ORDER BY ae.created_at DESC
			LIMIT $2
		`, userID, limit)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM activity_events ae
			JOIN users a ON a.id = ae.actor_id
			JOIN users t ON t.id = ae.target_id
			WHERE ae.actor_id = $1 AND ae.created_at < $2
			ORDER BY ae.created_at DESC
			LIMIT $3
		`, userID, cursor, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("get user activity: %w", err)
	}
	defer rows.Close()

	var events []ActivityEvent
	for rows.Next() {
		var e ActivityEvent
		if err := rows.Scan(
			&e.Type, &e.SubjectID, &e.SubjectTitle, &e.SubjectIGDBID, &e.CreatedAt,
			&e.ActorID, &e.ActorHandle, &e.ActorName, &e.ActorAvatarURL, &e.ActorColor,
			&e.RecipientID, &e.RecipientHandle, &e.RecipientName, &e.RecipientAvatarURL, &e.RecipientColor,
		); err != nil {
			return nil, fmt.Errorf("scan activity event: %w", err)
		}
		if e.Type == "new_comment" && e.SubjectID == nil {
			continue
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
