// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DateFormat is the wire format for played_at, which represents a calendar
// day (not a point in time).
const DateFormat = "2006-01-02"

// PendingJourney is a row from the pending_journeys table joined with igdb_games.
type PendingJourney struct {
	ID            string
	UserID        string
	Status        string
	IGDBID        *int
	GameName      *string
	CoverURL      *string
	Genres        []string
	ReleaseYear   *int
	ExeName       *string
	WindowTitle   *string
	StartedAt     time.Time
	EndedAt       *time.Time
	LastHeartbeat time.Time
}

// GetPendingJourney returns a single pending journey by ID and user ID.
// Returns an error if it does not exist or does not belong to the given user.
func GetPendingJourney(ctx context.Context, pool *pgxpool.Pool, id, userID string) (PendingJourney, error) {
	var p PendingJourney
	err := pool.QueryRow(ctx, `
		SELECT id, user_id, status, igdb_id, exe_name, window_title, started_at, ended_at, last_heartbeat
		FROM pending_journeys
		WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&p.ID, &p.UserID, &p.Status, &p.IGDBID,
		&p.ExeName, &p.WindowTitle,
		&p.StartedAt, &p.EndedAt, &p.LastHeartbeat,
	)
	if err == pgx.ErrNoRows {
		return PendingJourney{}, fmt.Errorf("pending journey not found: %s", id)
	}
	return p, err
}

// DeletePendingJourney removes a pending journey row. Used on confirm or discard.
func DeletePendingJourney(ctx context.Context, pool *pgxpool.Pool, id, userID string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM pending_journeys WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pending journey not found: %s", id)
	}
	return nil
}

// ListPendingJourneys returns all pending journeys for the given user with
// status 'active' or 'ended', joined with igdb_games, ordered by created_at descending.
func ListPendingJourneys(ctx context.Context, pool *pgxpool.Pool, userID string) ([]PendingJourney, error) {
	rows, err := pool.Query(ctx, `
		SELECT p.id, p.user_id, p.status, p.igdb_id, g.name, g.cover_url, g.genres, g.release_year,
		       p.exe_name, p.window_title, p.started_at, p.ended_at, p.last_heartbeat
		FROM pending_journeys p
		LEFT JOIN igdb_games g ON g.igdb_id = p.igdb_id
		WHERE p.user_id = $1 AND p.status = 'ended'
		ORDER BY p.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []PendingJourney
	for rows.Next() {
		var p PendingJourney
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.Status, &p.IGDBID, &p.GameName, &p.CoverURL, &p.Genres, &p.ReleaseYear,
			&p.ExeName, &p.WindowTitle,
			&p.StartedAt, &p.EndedAt, &p.LastHeartbeat,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, p)
	}
	return journeys, rows.Err()
}

// CountPendingJourneys returns the number of pending journeys with status
// 'ended' for the given user.
func CountPendingJourneys(ctx context.Context, pool *pgxpool.Pool, userID string) (int, error) {
	var count int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM pending_journeys
		WHERE user_id = $1 AND status = 'ended'
	`, userID).Scan(&count)
	return count, err
}

// Journey is a confirmed journey row joined with igdb_games.
type Journey struct {
	ID              string
	UserID          string
	IGDBID          int
	GameName        string
	CoverURL        *string
	Genres          []string
	ReleaseYear     *int
	StartedAt       time.Time
	EndedAt         time.Time
	DurationSeconds int
	Log             *string
	PlayedAt        time.Time
	CreatedAt       time.Time
}

// UpsertPendingJourney creates, deduplicates, or extends a pending journey atomically.
//
//   - Exact duplicate (same user, exe, started_at, ended_at): returns the existing ID unchanged.
//   - Merge candidate: a pending journey for the same exe whose ended_at falls within 15 minutes
//     before startedAt — its ended_at is extended to endedAt and its ID is returned.
//   - Otherwise: a new pending journey row is inserted and its ID is returned.
//
// igdbID and endedAt may be nil.
func UpsertPendingJourney(ctx context.Context, pool *pgxpool.Pool, userID, exeName, windowTitle string, startedAt time.Time, igdbID *int, endedAt *time.Time) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("begin upsert: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Exact duplicate — idempotent retry path.
	var id string
	err = tx.QueryRow(ctx, `
		SELECT id FROM pending_journeys
		WHERE user_id = $1 AND exe_name = $2 AND started_at = $3
		  AND ended_at IS NOT DISTINCT FROM $4
		LIMIT 1
	`, userID, exeName, startedAt, endedAt).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != pgx.ErrNoRows {
		return "", fmt.Errorf("check duplicate pending journey: %w", err)
	}

	// 2. Merge candidate — same exe, ended within 15 minutes before this session started.
	mergeWindowStart := startedAt.Add(-15 * time.Minute)
	err = tx.QueryRow(ctx, `
		SELECT id FROM pending_journeys
		WHERE user_id = $1 AND exe_name = $2 AND status = 'ended'
		  AND ended_at BETWEEN $3 AND $4
		ORDER BY ended_at DESC
		LIMIT 1
		FOR UPDATE
	`, userID, exeName, mergeWindowStart, startedAt).Scan(&id)
	if err == nil {
		if _, err = tx.Exec(ctx, `
			UPDATE pending_journeys SET ended_at = $1 WHERE id = $2
		`, endedAt, id); err != nil {
			return "", fmt.Errorf("extend pending journey: %w", err)
		}
		return id, tx.Commit(ctx)
	}
	if err != pgx.ErrNoRows {
		return "", fmt.Errorf("check merge candidate: %w", err)
	}

	// 3. New session.
	status := "active"
	if endedAt != nil {
		status = "ended"
	}
	if err = tx.QueryRow(ctx, `
		INSERT INTO pending_journeys (user_id, exe_name, window_title, started_at, igdb_id, ended_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, userID, exeName, windowTitle, startedAt, igdbID, endedAt, status).Scan(&id); err != nil {
		return "", fmt.Errorf("insert pending journey: %w", err)
	}
	return id, tx.Commit(ctx)
}

// EndPendingJourney sets ended_at and transitions status to 'ended'.
func EndPendingJourney(ctx context.Context, pool *pgxpool.Pool, id, userID string, endedAt time.Time) error {
	tag, err := pool.Exec(ctx, `
		UPDATE pending_journeys
		SET ended_at = $1, status = 'ended'
		WHERE id = $2 AND user_id = $3 AND status = 'active'
	`, endedAt, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pending journey not found or already ended: %s", id)
	}
	return nil
}

// LastJourneyLog returns the log text of the most recently created journey
// for userID, or nil if the user has no journeys or their most recent one
// has no log.
func LastJourneyLog(ctx context.Context, pool *pgxpool.Pool, userID string) (*string, error) {
	var log *string
	err := pool.QueryRow(ctx, `
		SELECT log FROM journeys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&log)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("last journey log: %w", err)
	}
	return log, nil
}

// InsertJourney writes a confirmed journey row and returns the new ID.
func InsertJourney(ctx context.Context, pool *pgxpool.Pool, j Journey) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO journeys (user_id, igdb_id, started_at, ended_at, duration_seconds, log, played_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, j.UserID, j.IGDBID, j.StartedAt, j.EndedAt, j.DurationSeconds, j.Log, j.PlayedAt).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert journey: %w", err)
	}
	return id, nil
}

// UpdateJourney updates mutable fields of a confirmed journey owned by userID.
// playedAt is the calendar day the journey is logged against, independent of
// started_at/ended_at (which only track duration bookkeeping).
func UpdateJourney(ctx context.Context, pool *pgxpool.Pool, id, userID string, igdbID, durationSeconds int, endedAt, playedAt time.Time, log *string) error {
	startedAt := endedAt.Add(-time.Duration(durationSeconds) * time.Second)
	tag, err := pool.Exec(ctx, `
		UPDATE journeys
		SET igdb_id = $3, duration_seconds = $4, started_at = $5, ended_at = $6, played_at = $7, log = $8
		WHERE id = $1 AND user_id = $2
	`, id, userID, igdbID, durationSeconds, startedAt, endedAt, playedAt, log)
	if err != nil {
		return fmt.Errorf("update journey: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("journey not found: %s", id)
	}
	return nil
}

// DeleteJourney removes a confirmed journey by ID and user ID.
func DeleteJourney(ctx context.Context, pool *pgxpool.Pool, id, userID string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM journeys WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("journey not found: %s", id)
	}
	return nil
}

// JourneyWithPlayer is a confirmed journey row joined with igdb_games and users.
type JourneyWithPlayer struct {
	ID              string
	UserID          string
	IGDBID          int
	GameName        string
	CoverURL        *string
	Genres          []string
	ReleaseYear     *int
	DurationSeconds int
	Log             *string
	PlayedAt        time.Time
	CreatedAt       time.Time
	PlayerHandle    string
	PlayerName      string
	PlayerAvatarURL *string
	PlayerColor     string
}

// GetJourneyByID returns a single confirmed journey by ID, joined with igdb_games and users.
func GetJourneyByID(ctx context.Context, pool *pgxpool.Pool, id string) (JourneyWithPlayer, error) {
	var j JourneyWithPlayer
	err := pool.QueryRow(ctx, `
		SELECT j.id, j.user_id, j.igdb_id, g.name, g.cover_url, g.genres, g.release_year,
		       j.duration_seconds, j.log, j.played_at,
		       u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id
		JOIN users u ON u.id = j.user_id
		WHERE j.id = $1`, id).Scan(
		&j.ID, &j.UserID, &j.IGDBID, &j.GameName, &j.CoverURL, &j.Genres, &j.ReleaseYear,
		&j.DurationSeconds, &j.Log, &j.PlayedAt,
		&j.PlayerHandle, &j.PlayerName, &j.PlayerAvatarURL, &j.PlayerColor,
	)
	if err == pgx.ErrNoRows {
		return JourneyWithPlayer{}, fmt.Errorf("journey not found: %s", id)
	}
	return j, err
}

// PlayerOnJourney is a player who has a journey for the same game as another journey.
type PlayerOnJourney struct {
	JourneyID       string
	DurationSeconds int
	PlayedAt        time.Time
	CreatedAt       time.Time
	UserID          string
	Handle          string
	Name            string
	AvatarURL       *string
	Color           string
}

// ListOthersOnJourney returns players who have journeys for the same IGDB game as
// the given journey ID, excluding the journey's own owner, ordered by played_at desc.
func ListOthersOnJourney(ctx context.Context, pool *pgxpool.Pool, journeyID string) ([]PlayerOnJourney, error) {
	rows, err := pool.Query(ctx, `
		WITH src AS (SELECT igdb_id, user_id FROM journeys WHERE id = $1)
		SELECT j.id, j.duration_seconds, j.played_at, j.created_at,
		       u.id, u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color
		FROM journeys j
		JOIN users u ON u.id = j.user_id
		JOIN src ON j.igdb_id = src.igdb_id AND j.user_id != src.user_id
		ORDER BY j.played_at DESC, j.created_at DESC
		LIMIT 50
	`, journeyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []PlayerOnJourney
	for rows.Next() {
		var p PlayerOnJourney
		if err := rows.Scan(
			&p.JourneyID, &p.DurationSeconds, &p.PlayedAt, &p.CreatedAt,
			&p.UserID, &p.Handle, &p.Name, &p.AvatarURL, &p.Color,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}
	return players, rows.Err()
}

// ListJourneysByIGDBID returns all journeys for the given game, ordered by
// played_at desc, with cursor-based pagination. The caller uses GetFollowingIDs
// to split following/others/self.
func ListJourneysByIGDBID(ctx context.Context, pool *pgxpool.Pool, igdbID, limit int, cursor string) ([]PlayerOnJourney, error) {
	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT j.id, j.duration_seconds, j.played_at, j.created_at,
			       u.id, u.handle, COALESCE(u.display_name, u.name),
			       COALESCE(u.custom_avatar_url, u.avatar_url), u.color
			FROM journeys j
			JOIN users u ON u.id = j.user_id
			WHERE j.igdb_id = $1
			ORDER BY j.played_at DESC, j.created_at DESC
			LIMIT $2
		`, igdbID, limit)
	} else {
		playedAt, createdAt, err2 := splitJourneyCursor(cursor)
		if err2 != nil {
			return nil, err2
		}
		rows, err = pool.Query(ctx, `
			SELECT j.id, j.duration_seconds, j.played_at, j.created_at,
			       u.id, u.handle, COALESCE(u.display_name, u.name),
			       COALESCE(u.custom_avatar_url, u.avatar_url), u.color
			FROM journeys j
			JOIN users u ON u.id = j.user_id
			WHERE j.igdb_id = $1 AND (j.played_at, j.created_at) < ($2, $3)
			ORDER BY j.played_at DESC, j.created_at DESC
			LIMIT $4
		`, igdbID, playedAt, createdAt, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []PlayerOnJourney
	for rows.Next() {
		var p PlayerOnJourney
		if err := rows.Scan(
			&p.JourneyID, &p.DurationSeconds, &p.PlayedAt, &p.CreatedAt,
			&p.UserID, &p.Handle, &p.Name, &p.AvatarURL, &p.Color,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}
	return players, rows.Err()
}

// ActivityEntry is a single journey row for the discovery feed, joined with game and player info.
type ActivityEntry struct {
	SessionID       string
	UserID          string
	IGDBID          int
	GameName        string
	CoverURL        *string
	Genres          []string
	ReleaseYear     *int
	DurationSeconds int
	Log             *string
	PlayedAt        time.Time
	PlayerHandle    string
	PlayerName      string
	PlayerAvatarURL *string
	PlayerColor     string
}

// GetGameActivity returns the diversity-capped discovery feed: at most 12 games ranked
// by unique-player count, with at most 4 deduplicated (one per player) sessions each.
func GetGameActivity(ctx context.Context, pool *pgxpool.Pool) ([]ActivityEntry, error) {
	rows, err := pool.Query(ctx, `
		WITH latest_per_player_game AS (
			SELECT DISTINCT ON (j.user_id, j.igdb_id)
				j.id, j.user_id, j.igdb_id, j.duration_seconds, j.log, j.played_at, j.created_at,
				g.name AS game_name, g.cover_url, g.genres, g.release_year,
				u.handle, COALESCE(u.display_name, u.name) AS player_name, COALESCE(u.custom_avatar_url, u.avatar_url) AS avatar_url, u.color
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			JOIN users u ON u.id = j.user_id
			ORDER BY j.user_id, j.igdb_id, j.played_at DESC, j.created_at DESC
		),
		game_stats AS (
			SELECT igdb_id, COUNT(*) AS unique_players, MAX(played_at) AS last_played
			FROM latest_per_player_game
			GROUP BY igdb_id
		),
		top_games AS (
			SELECT igdb_id,
			       ROW_NUMBER() OVER (ORDER BY last_played DESC) AS game_rank
			FROM game_stats
			LIMIT 12
		),
		ranked_entries AS (
			SELECT l.id, l.user_id, l.igdb_id, l.duration_seconds, l.log, l.played_at, l.created_at,
			       l.game_name, l.cover_url, l.genres, l.release_year,
			       l.handle, l.player_name, l.avatar_url, l.color,
			       t.game_rank,
			       ROW_NUMBER() OVER (PARTITION BY l.igdb_id ORDER BY l.played_at DESC, l.created_at DESC) AS entry_rank
			FROM latest_per_player_game l
			JOIN top_games t ON t.igdb_id = l.igdb_id
		)
		SELECT id, user_id, igdb_id, game_name, cover_url, genres, release_year,
		       duration_seconds, log, played_at,
		       handle, player_name, avatar_url, color
		FROM ranked_entries
		WHERE entry_rank <= 4
		ORDER BY game_rank, played_at DESC, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ActivityEntry
	for rows.Next() {
		var e ActivityEntry
		if err := rows.Scan(
			&e.SessionID, &e.UserID, &e.IGDBID, &e.GameName, &e.CoverURL, &e.Genres, &e.ReleaseYear,
			&e.DurationSeconds, &e.Log, &e.PlayedAt,
			&e.PlayerHandle, &e.PlayerName, &e.PlayerAvatarURL, &e.PlayerColor,
		); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// GetFollowingFeed returns journeys from users that userID follows, joined with
// game and player info, ordered by played_at then created_at descending with
// optional cursor pagination. cursor, if non-empty, is "<played_at>,<created_at>"
// as produced by DateFormat and RFC3339 respectively.
func GetFollowingFeed(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]JourneyWithPlayer, error) {
	const cols = `
		j.id, j.user_id, j.igdb_id, g.name, g.cover_url, g.genres, g.release_year,
		j.duration_seconds, j.log, j.played_at, j.created_at,
		u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color`

	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			JOIN users u ON u.id = j.user_id
			JOIN follows f ON f.followee_id = j.user_id
			WHERE f.follower_id = $1
			ORDER BY j.played_at DESC, j.created_at DESC
			LIMIT $2
		`, userID, limit)
	} else {
		playedAt, createdAt, err2 := splitJourneyCursor(cursor)
		if err2 != nil {
			return nil, err2
		}
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			JOIN users u ON u.id = j.user_id
			JOIN follows f ON f.followee_id = j.user_id
			WHERE f.follower_id = $1 AND (j.played_at, j.created_at) < ($2, $3)
			ORDER BY j.played_at DESC, j.created_at DESC
			LIMIT $4
		`, userID, playedAt, createdAt, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []JourneyWithPlayer
	for rows.Next() {
		var j JourneyWithPlayer
		if err := rows.Scan(
			&j.ID, &j.UserID, &j.IGDBID, &j.GameName, &j.CoverURL, &j.Genres, &j.ReleaseYear,
			&j.DurationSeconds, &j.Log, &j.PlayedAt, &j.CreatedAt,
			&j.PlayerHandle, &j.PlayerName, &j.PlayerAvatarURL, &j.PlayerColor,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, j)
	}
	return journeys, rows.Err()
}

// splitJourneyCursor parses a composite "<played_at>,<created_at>" cursor
// into its played_at (date) and created_at (timestamptz) components.
func splitJourneyCursor(cursor string) (playedAt time.Time, createdAt time.Time, err error) {
	playedAtStr, createdAtStr, ok := strings.Cut(cursor, ",")
	if !ok {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid journey cursor: %q", cursor)
	}
	playedAt, err = time.Parse(DateFormat, playedAtStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid journey cursor played_at: %w", err)
	}
	createdAt, err = time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid journey cursor created_at: %w", err)
	}
	return playedAt, createdAt, nil
}

// EncodeJourneyCursor builds a composite "<played_at>,<created_at>" cursor value.
func EncodeJourneyCursor(playedAt, createdAt time.Time) string {
	return playedAt.Format(DateFormat) + "," + createdAt.UTC().Format(time.RFC3339)
}

// JourneyComment is a comment row joined with the commenter's user info.
type JourneyComment struct {
	ID              string
	JourneyID       string
	UserID          string
	Body            string
	CreatedAt       time.Time
	PlayerHandle    string
	PlayerName      string
	PlayerAvatarURL *string
	PlayerColor     string
}

// EncodeCommentCursor encodes a (created_at, id) pair as a stable cursor for
// comment lists ordered by (created_at ASC, id ASC).
func EncodeCommentCursor(createdAt time.Time, id string) string {
	return createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
}

// splitCommentCursor parses a cursor produced by EncodeCommentCursor.
func splitCommentCursor(cursor string) (createdAt time.Time, id string, err error) {
	i := strings.LastIndex(cursor, "|")
	if i < 0 {
		return time.Time{}, "", fmt.Errorf("invalid comment cursor")
	}
	createdAt, err = time.Parse(time.RFC3339Nano, cursor[:i])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("parse comment cursor time: %w", err)
	}
	return createdAt, cursor[i+1:], nil
}

// ListComments returns comments for the given journey ordered by (created_at, id) ASC.
// limit controls the page size; cursor resumes from the position encoded by EncodeCommentCursor.
func ListComments(ctx context.Context, pool *pgxpool.Pool, journeyID string, limit int, cursor string) ([]JourneyComment, error) {
	const cols = `c.id, c.journey_id, c.user_id, c.body, c.created_at,
		       u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color`
	const from = `FROM comments c JOIN users u ON u.id = c.user_id`

	var rows pgx.Rows
	var err error
	if at, id, cerr := splitCommentCursor(cursor); cerr == nil {
		rows, err = pool.Query(ctx, `
			SELECT `+cols+` `+from+`
			WHERE c.journey_id = $1
			  AND (c.created_at, c.id) > ($2, $3)
			ORDER BY c.created_at ASC, c.id ASC
			LIMIT $4
		`, journeyID, at, id, limit)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT `+cols+` `+from+`
			WHERE c.journey_id = $1
			ORDER BY c.created_at ASC, c.id ASC
			LIMIT $2
		`, journeyID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []JourneyComment
	for rows.Next() {
		var c JourneyComment
		if err := rows.Scan(
			&c.ID, &c.JourneyID, &c.UserID, &c.Body, &c.CreatedAt,
			&c.PlayerHandle, &c.PlayerName, &c.PlayerAvatarURL, &c.PlayerColor,
		); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}

// LastCommentBody returns the body of the most recently created comment by
// userID, or "" if the user has not commented before.
func LastCommentBody(ctx context.Context, pool *pgxpool.Pool, userID string) (string, error) {
	var body string
	err := pool.QueryRow(ctx, `
		SELECT body FROM comments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
	`, userID).Scan(&body)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("last comment body: %w", err)
	}
	return body, nil
}

// InsertComment writes a new comment and returns it with the commenter's player info.
func InsertComment(ctx context.Context, pool *pgxpool.Pool, journeyID, userID, body string) (JourneyComment, error) {
	var c JourneyComment
	err := pool.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO comments (journey_id, user_id, body)
			VALUES ($1, $2, $3)
			RETURNING id, journey_id, user_id, body, created_at
		)
		SELECT ins.id, ins.journey_id, ins.user_id, ins.body, ins.created_at,
		       u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color
		FROM ins
		JOIN users u ON u.id = ins.user_id
	`, journeyID, userID, body).Scan(
		&c.ID, &c.JourneyID, &c.UserID, &c.Body, &c.CreatedAt,
		&c.PlayerHandle, &c.PlayerName, &c.PlayerAvatarURL, &c.PlayerColor,
	)
	if err != nil {
		return JourneyComment{}, fmt.Errorf("insert comment: %w", err)
	}
	return c, nil
}

// DeleteComment removes a comment by ID, only if it belongs to the given user.
func DeleteComment(ctx context.Context, pool *pgxpool.Pool, commentID, userID string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM comments WHERE id = $1 AND user_id = $2
	`, commentID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found: %s", commentID)
	}
	return nil
}

// ListJourneysByUser returns confirmed journeys for the given user ID joined
// with igdb_games, ordered by played_at then created_at descending, with
// optional cursor-based pagination. cursor, if non-empty, is
// "<played_at>,<created_at>" as produced by EncodeJourneyCursor.
func ListJourneysByUser(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]Journey, error) {
	const query = `
		SELECT j.id, j.user_id, j.igdb_id, g.name, g.cover_url, g.genres, g.release_year,
		       j.started_at, j.ended_at, j.duration_seconds, j.log, j.played_at, j.created_at
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id`

	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, query+`
			WHERE j.user_id = $1 ORDER BY j.played_at DESC, j.created_at DESC LIMIT $2`,
			userID, limit)
	} else {
		playedAt, createdAt, err2 := splitJourneyCursor(cursor)
		if err2 != nil {
			return nil, err2
		}
		rows, err = pool.Query(ctx, query+`
			WHERE j.user_id = $1 AND (j.played_at, j.created_at) < ($2, $3) ORDER BY j.played_at DESC, j.created_at DESC LIMIT $4`,
			userID, playedAt, createdAt, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []Journey
	for rows.Next() {
		var j Journey
		if err := rows.Scan(
			&j.ID, &j.UserID, &j.IGDBID, &j.GameName, &j.CoverURL, &j.Genres, &j.ReleaseYear,
			&j.StartedAt, &j.EndedAt, &j.DurationSeconds,
			&j.Log, &j.PlayedAt, &j.CreatedAt,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, j)
	}
	return journeys, rows.Err()
}
