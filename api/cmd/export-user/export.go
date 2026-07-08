// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// isUUID reports whether s looks like a UUID, as opposed to a handle.
func isUUID(s string) bool {
	return uuidPattern.MatchString(s)
}

// resolveUserID looks up the internal user ID for identifier, which may be
// either the user's UUID or their Discord handle (case-insensitive).
func resolveUserID(ctx context.Context, pool *pgxpool.Pool, identifier string) (string, error) {
	if isUUID(identifier) {
		var id string
		err := pool.QueryRow(ctx, `SELECT id FROM users WHERE id = $1`, identifier).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("look up by id: %w", err)
		}
		return id, nil
	}

	var id string
	err := pool.QueryRow(ctx, `SELECT id FROM users WHERE lower(handle) = lower($1)`, identifier).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("look up by handle: %w", err)
	}
	return id, nil
}

// Export is the full set of data Yurnik holds about one user.
type Export struct {
	GeneratedAt   time.Time      `json:"generated_at"`
	User          UserRow        `json:"user"`
	Journeys      []JourneyRow   `json:"journeys"`
	Comments      []CommentRow   `json:"comments"`
	Following     []FollowRow    `json:"following"`
	Followers     []FollowRow    `json:"followers"`
	Notifications        []NotificationRow      `json:"notifications"`
	ExeExclusions []ExclusionRow `json:"exe_exclusions"`
	ExeGameHints  []GameHintRow  `json:"exe_game_hints"`
}

type UserRow struct {
	ID              string    `json:"id"`
	Provider        string    `json:"provider"`
	ProviderID      string    `json:"provider_id"`
	Handle          string    `json:"handle"`
	Name            string    `json:"name"`
	AvatarURL       *string   `json:"avatar_url"`
	CustomAvatarURL *string   `json:"custom_avatar_url"`
	DisplayName     *string   `json:"display_name"`
	Bio             *string   `json:"bio"`
	Color           string    `json:"color"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type JourneyRow struct {
	ID              string    `json:"id"`
	IGDBID          int       `json:"igdb_id"`
	StartedAt       time.Time `json:"started_at"`
	EndedAt         time.Time `json:"ended_at"`
	DurationSeconds int       `json:"duration_seconds"`
	Log             *string   `json:"log"`
	PlayedAt        time.Time `json:"played_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type CommentRow struct {
	JourneyID string    `json:"journey_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

// FollowRow is one side of the follow graph: the other player involved and
// when the relationship was created.
type FollowRow struct {
	UserID    string    `json:"user_id"`
	Handle    string    `json:"handle"`
	CreatedAt time.Time `json:"created_at"`
}

type NotificationRow struct {
	ID           int64      `json:"id"`
	Type         string     `json:"type"`
	SubjectID    *string    `json:"subject_id"`
	SubjectTitle *string    `json:"subject_title"`
	SeenAt       *time.Time `json:"seen_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type ExclusionRow struct {
	ID        string    `json:"id"`
	ExeName   string    `json:"exe_name"`
	CreatedAt time.Time `json:"created_at"`
}

type GameHintRow struct {
	ExeName   string    `json:"exe_name"`
	IGDBID    int       `json:"igdb_id"`
	UpdatedAt time.Time `json:"updated_at"`
}

// buildExport gathers every table that references userID into a single Export.
func buildExport(ctx context.Context, pool *pgxpool.Pool, userID string) (Export, error) {
	export := Export{GeneratedAt: time.Now().UTC()}

	if err := pool.QueryRow(ctx, `
		SELECT id, provider, provider_id, handle, name, avatar_url, custom_avatar_url,
		       display_name, bio, color, created_at, updated_at
		FROM users WHERE id = $1
	`, userID).Scan(
		&export.User.ID, &export.User.Provider, &export.User.ProviderID, &export.User.Handle,
		&export.User.Name, &export.User.AvatarURL, &export.User.CustomAvatarURL,
		&export.User.DisplayName, &export.User.Bio, &export.User.Color,
		&export.User.CreatedAt, &export.User.UpdatedAt,
	); err != nil {
		return Export{}, fmt.Errorf("query user: %w", err)
	}

	journeys, err := queryRows(ctx, pool, `
		SELECT id, igdb_id, started_at, ended_at, duration_seconds, log, played_at, created_at
		FROM journeys WHERE user_id = $1 ORDER BY created_at
	`, userID, func(scan scanFunc) (JourneyRow, error) {
		var r JourneyRow
		err := scan(&r.ID, &r.IGDBID, &r.StartedAt, &r.EndedAt, &r.DurationSeconds, &r.Log, &r.PlayedAt, &r.CreatedAt)
		return r, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("query journeys: %w", err)
	}
	export.Journeys = journeys

	comments, err := queryRows(ctx, pool, `
		SELECT journey_id, body, created_at FROM comments WHERE user_id = $1 ORDER BY created_at
	`, userID, func(scan scanFunc) (CommentRow, error) {
		var r CommentRow
		err := scan(&r.JourneyID, &r.Body, &r.CreatedAt)
		return r, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("query comments: %w", err)
	}
	export.Comments = comments

	following, err := queryRows(ctx, pool, `
		SELECT u.id, u.handle, f.created_at
		FROM follows f JOIN users u ON u.id = f.followee_id
		WHERE f.follower_id = $1 ORDER BY f.created_at
	`, userID, scanFollowRow)
	if err != nil {
		return Export{}, fmt.Errorf("query following: %w", err)
	}
	export.Following = following

	followers, err := queryRows(ctx, pool, `
		SELECT u.id, u.handle, f.created_at
		FROM follows f JOIN users u ON u.id = f.follower_id
		WHERE f.followee_id = $1 ORDER BY f.created_at
	`, userID, scanFollowRow)
	if err != nil {
		return Export{}, fmt.Errorf("query followers: %w", err)
	}
	export.Followers = followers

	notifications, err := queryRows(ctx, pool, `
		SELECT id, type, subject_id, subject_title, seen_at, created_at, updated_at
		FROM notifications WHERE recipient_id = $1 ORDER BY created_at
	`, userID, func(scan scanFunc) (NotificationRow, error) {
		var r NotificationRow
		err := scan(&r.ID, &r.Type, &r.SubjectID, &r.SubjectTitle, &r.SeenAt, &r.CreatedAt, &r.UpdatedAt)
		return r, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("query notifications: %w", err)
	}
	export.Notifications = notifications

	exclusions, err := queryRows(ctx, pool, `
		SELECT id, exe_name, created_at FROM exe_exclusions WHERE user_id = $1 ORDER BY created_at
	`, userID, func(scan scanFunc) (ExclusionRow, error) {
		var r ExclusionRow
		err := scan(&r.ID, &r.ExeName, &r.CreatedAt)
		return r, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("query exe_exclusions: %w", err)
	}
	export.ExeExclusions = exclusions

	hints, err := queryRows(ctx, pool, `
		SELECT exe_name, igdb_id, updated_at FROM exe_game_hints WHERE user_id = $1 ORDER BY exe_name
	`, userID, func(scan scanFunc) (GameHintRow, error) {
		var r GameHintRow
		err := scan(&r.ExeName, &r.IGDBID, &r.UpdatedAt)
		return r, err
	})
	if err != nil {
		return Export{}, fmt.Errorf("query exe_game_hints: %w", err)
	}
	export.ExeGameHints = hints

	return export, nil
}

// scanFunc scans a single row's columns into the destinations given.
type scanFunc func(dest ...any) error

// queryRows runs query with args, scanning each row with scan, and returns the collected results.
func queryRows[T any](ctx context.Context, pool *pgxpool.Pool, query string, arg string, scan func(scanFunc) (T, error)) ([]T, error) {
	rows, err := pool.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []T
	for rows.Next() {
		r, err := scan(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func scanFollowRow(scan scanFunc) (FollowRow, error) {
	var r FollowRow
	err := scan(&r.UserID, &r.Handle, &r.CreatedAt)
	return r, err
}
