// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EncodeEchoCursor encodes an echo pagination cursor from updated_at and id.
func EncodeEchoCursor(updatedAt time.Time, id int64) string {
	return updatedAt.UTC().Format(time.RFC3339Nano) + "|" + strconv.FormatInt(id, 10)
}

func splitEchoCursor(cursor string) (time.Time, int64, error) {
	idx := strings.LastIndex(cursor, "|")
	if idx < 0 {
		return time.Time{}, 0, fmt.Errorf("invalid echo cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, cursor[:idx])
	if err != nil {
		return time.Time{}, 0, fmt.Errorf("invalid echo cursor time: %w", err)
	}
	id, err := strconv.ParseInt(cursor[idx+1:], 10, 64)
	if err != nil {
		return time.Time{}, 0, fmt.Errorf("invalid echo cursor id: %w", err)
	}
	return t, id, nil
}

// EchoActor is a player who contributed to a batched echo.
type EchoActor struct {
	ID        string  `json:"id"`
	Handle    string  `json:"handle"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url"`
	Color     string  `json:"color"`
}

// EchoRow is a batched notification row with its actors resolved.
type EchoRow struct {
	ID            int64
	Type          string
	SubjectID     *string
	SubjectIgdbID *int
	SubjectTitle  *string
	Unread        bool
	ActorCount    int
	Actors        []EchoActor
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// JourneyMeta holds the owner and game name for a journey — used when creating comment echoes.
type JourneyMeta struct {
	OwnerID  string
	GameName string
}

// GetJourneyMeta returns the owner user_id and game name for the given journey.
func GetJourneyMeta(ctx context.Context, pool *pgxpool.Pool, journeyID string) (JourneyMeta, error) {
	var m JourneyMeta
	err := pool.QueryRow(ctx, `
		SELECT j.user_id, g.name
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id
		WHERE j.id = $1
	`, journeyID).Scan(&m.OwnerID, &m.GameName)
	if err != nil {
		return JourneyMeta{}, fmt.Errorf("get journey meta %s: %w", journeyID, err)
	}
	return m, nil
}

// UpsertCommentEcho creates or updates a new_comment echo for the journey owner when
// actorID posts a comment. No-op if actorID == recipientID (own journey).
// New activity resets seen_at so the echo appears unread again.
func UpsertCommentEcho(ctx context.Context, pool *pgxpool.Pool, recipientID, actorID, journeyID, subjectTitle string) error {
	if recipientID == actorID {
		return nil
	}
	var echoID int64
	err := pool.QueryRow(ctx, `
		SELECT id FROM echoes
		WHERE recipient_id = $1 AND type = 'new_comment' AND subject_id = $2 AND batch_until > now()
		ORDER BY id DESC LIMIT 1
	`, recipientID, journeyID).Scan(&echoID)

	if err == pgx.ErrNoRows {
		err = pool.QueryRow(ctx, `
			INSERT INTO echoes (recipient_id, type, subject_id, subject_title, updated_at, batch_until)
			VALUES ($1, 'new_comment', $2, $3, now(), now() + interval '24 hours')
			RETURNING id
		`, recipientID, journeyID, subjectTitle).Scan(&echoID)
		if err != nil {
			return fmt.Errorf("upsert comment echo insert: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("upsert comment echo select: %w", err)
	} else {
		_, err = pool.Exec(ctx, `
			UPDATE echoes SET updated_at = now(), subject_title = $1, seen_at = NULL
			WHERE id = $2
		`, subjectTitle, echoID)
		if err != nil {
			return fmt.Errorf("upsert comment echo update: %w", err)
		}
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO echo_actors (echo_id, actor_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, echoID, actorID)
	return err
}

// UpsertCommentReplyEcho creates or updates a new_comment_reply echo for recipientID,
// who previously commented on journeyID, when actorID posts a new comment there.
// No-op if actorID == recipientID (commenting on your own prior comment).
func UpsertCommentReplyEcho(ctx context.Context, pool *pgxpool.Pool, recipientID, actorID, journeyID, subjectTitle string) error {
	if recipientID == actorID {
		return nil
	}
	var echoID int64
	err := pool.QueryRow(ctx, `
		SELECT id FROM echoes
		WHERE recipient_id = $1 AND type = 'new_comment_reply' AND subject_id = $2 AND batch_until > now()
		ORDER BY id DESC LIMIT 1
	`, recipientID, journeyID).Scan(&echoID)

	if err == pgx.ErrNoRows {
		err = pool.QueryRow(ctx, `
			INSERT INTO echoes (recipient_id, type, subject_id, subject_title, updated_at, batch_until)
			VALUES ($1, 'new_comment_reply', $2, $3, now(), now() + interval '24 hours')
			RETURNING id
		`, recipientID, journeyID, subjectTitle).Scan(&echoID)
		if err != nil {
			return fmt.Errorf("upsert comment reply echo insert: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("upsert comment reply echo select: %w", err)
	} else {
		_, err = pool.Exec(ctx, `
			UPDATE echoes SET updated_at = now(), subject_title = $1, seen_at = NULL
			WHERE id = $2
		`, subjectTitle, echoID)
		if err != nil {
			return fmt.Errorf("upsert comment reply echo update: %w", err)
		}
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO echo_actors (echo_id, actor_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, echoID, actorID)
	return err
}

// UpsertMentionEcho creates or updates a new_mention echo for recipientID when
// actorID @mentions them in a comment on journeyID. No-op if actorID ==
// recipientID (self-mention). Mentioning the same user again on the same
// journey batches into the existing echo, same as new_comment.
func UpsertMentionEcho(ctx context.Context, pool *pgxpool.Pool, recipientID, actorID, journeyID, subjectTitle string) error {
	if recipientID == actorID {
		return nil
	}
	var echoID int64
	err := pool.QueryRow(ctx, `
		SELECT id FROM echoes
		WHERE recipient_id = $1 AND type = 'new_mention' AND subject_id = $2 AND batch_until > now()
		ORDER BY id DESC LIMIT 1
	`, recipientID, journeyID).Scan(&echoID)

	if err == pgx.ErrNoRows {
		err = pool.QueryRow(ctx, `
			INSERT INTO echoes (recipient_id, type, subject_id, subject_title, updated_at, batch_until)
			VALUES ($1, 'new_mention', $2, $3, now(), now() + interval '24 hours')
			RETURNING id
		`, recipientID, journeyID, subjectTitle).Scan(&echoID)
		if err != nil {
			return fmt.Errorf("upsert mention echo insert: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("upsert mention echo select: %w", err)
	} else {
		_, err = pool.Exec(ctx, `
			UPDATE echoes SET updated_at = now(), subject_title = $1, seen_at = NULL
			WHERE id = $2
		`, subjectTitle, echoID)
		if err != nil {
			return fmt.Errorf("upsert mention echo update: %w", err)
		}
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO echo_actors (echo_id, actor_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, echoID, actorID)
	return err
}

// UpsertFollowerEcho creates or updates a new_follower echo for recipientID when
// actorID follows them. New activity resets seen_at.
func UpsertFollowerEcho(ctx context.Context, pool *pgxpool.Pool, recipientID, actorID string) error {
	var echoID int64
	err := pool.QueryRow(ctx, `
		SELECT id FROM echoes
		WHERE recipient_id = $1 AND type = 'new_follower' AND batch_until > now()
		ORDER BY id DESC LIMIT 1
	`, recipientID).Scan(&echoID)

	if err == pgx.ErrNoRows {
		err = pool.QueryRow(ctx, `
			INSERT INTO echoes (recipient_id, type, updated_at, batch_until)
			VALUES ($1, 'new_follower', now(), now() + interval '24 hours')
			RETURNING id
		`, recipientID).Scan(&echoID)
		if err != nil {
			return fmt.Errorf("upsert follower echo insert: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("upsert follower echo select: %w", err)
	} else {
		_, err = pool.Exec(ctx, `
			UPDATE echoes SET updated_at = now(), seen_at = NULL
			WHERE id = $1
		`, echoID)
		if err != nil {
			return fmt.Errorf("upsert follower echo update: %w", err)
		}
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO echo_actors (echo_id, actor_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, echoID, actorID)
	return err
}

// ListEchoes returns up to limit echoes for the user, reverse chronological by updated_at.
// Each echo includes up to 3 actor profiles and the total actor count.
// cursor (optional) is an opaque token from EncodeEchoCursor for keyset pagination.
func ListEchoes(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]EchoRow, error) {
	const baseSelect = `
		SELECT
			e.id,
			e.type,
			e.subject_id,
			e.subject_igdb_id,
			e.subject_title,
			e.seen_at IS NULL AS unread,
			e.created_at,
			e.updated_at,
			(SELECT COUNT(*)::int FROM echo_actors WHERE echo_id = e.id) AS actor_count,
			(
				SELECT json_agg(json_build_object(
					'id', u.id, 'handle', u.handle, 'name', u.name,
					'avatar_url', u.avatar_url, 'color', u.color
				))
				FROM (
					SELECT u.id, u.handle, u.name, u.avatar_url, u.color
					FROM echo_actors ea
					JOIN users u ON u.id = ea.actor_id
					WHERE ea.echo_id = e.id
					ORDER BY ea.created_at DESC
					LIMIT 3
				) u
			) AS actors
		FROM echoes e
	`
	var rows pgx.Rows
	var err error
	if cursor == "" {
		rows, err = pool.Query(ctx, baseSelect+`
			WHERE e.recipient_id = $1
			ORDER BY e.updated_at DESC, e.id DESC
			LIMIT $2
		`, userID, limit)
	} else {
		var cursorTime time.Time
		var cursorID int64
		cursorTime, cursorID, err = splitEchoCursor(cursor)
		if err != nil {
			return nil, fmt.Errorf("list echoes: %w", err)
		}
		rows, err = pool.Query(ctx, baseSelect+`
			WHERE e.recipient_id = $1
			AND (e.updated_at, e.id) < ($2, $3)
			ORDER BY e.updated_at DESC, e.id DESC
			LIMIT $4
		`, userID, cursorTime, cursorID, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("list echoes: %w", err)
	}
	defer rows.Close()

	var echoes []EchoRow
	for rows.Next() {
		var e EchoRow
		var actorsJSON []byte
		if err := rows.Scan(
			&e.ID, &e.Type, &e.SubjectID, &e.SubjectIgdbID, &e.SubjectTitle,
			&e.Unread, &e.CreatedAt, &e.UpdatedAt,
			&e.ActorCount, &actorsJSON,
		); err != nil {
			return nil, fmt.Errorf("scan echo row: %w", err)
		}
		if actorsJSON != nil {
			if err := json.Unmarshal(actorsJSON, &e.Actors); err != nil {
				return nil, fmt.Errorf("unmarshal actors: %w", err)
			}
		}
		echoes = append(echoes, e)
	}
	return echoes, rows.Err()
}

// MarkEchoesRead stamps seen_at on all unseen echoes for the user.
func MarkEchoesRead(ctx context.Context, pool *pgxpool.Pool, userID string) error {
	_, err := pool.Exec(ctx, `
		UPDATE echoes SET seen_at = now()
		WHERE recipient_id = $1 AND seen_at IS NULL
	`, userID)
	return err
}
