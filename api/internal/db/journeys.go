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

// PendingJourney is a row from the pending_journeys table joined with igdb_games.
type PendingJourney struct {
	ID            string
	UserID        string
	Status        string
	IGDBID        *int
	GameName      *string
	CoverURL      *string
	Genres        []string
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
		SELECT p.id, p.user_id, p.status, p.igdb_id, g.name, g.cover_url, g.genres,
		       p.exe_name, p.window_title, p.started_at, p.ended_at, p.last_heartbeat
		FROM pending_journeys p
		LEFT JOIN igdb_games g ON g.igdb_id = p.igdb_id
		WHERE p.user_id = $1 AND p.status IN ('active', 'ended')
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
			&p.ID, &p.UserID, &p.Status, &p.IGDBID, &p.GameName, &p.CoverURL, &p.Genres,
			&p.ExeName, &p.WindowTitle,
			&p.StartedAt, &p.EndedAt, &p.LastHeartbeat,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, p)
	}
	return journeys, rows.Err()
}

// Journey is a confirmed journey row joined with igdb_games.
type Journey struct {
	ID              string
	UserID          string
	IGDBID          int
	GameName        string
	CoverURL        *string
	Genres          []string
	StartedAt       time.Time
	EndedAt         time.Time
	DurationSeconds int
	Log             *string
	PlayedAt        time.Time
	CreatedAt       time.Time
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
	DurationSeconds int
	Log             *string
	PlayedAt        time.Time
	PlayerHandle    string
	PlayerName      string
	PlayerAvatarURL *string
	PlayerColor     string
}

// GetJourneyByID returns a single confirmed journey by ID, joined with igdb_games and users.
func GetJourneyByID(ctx context.Context, pool *pgxpool.Pool, id string) (JourneyWithPlayer, error) {
	var j JourneyWithPlayer
	err := pool.QueryRow(ctx, `
		SELECT j.id, j.user_id, j.igdb_id, g.name, g.cover_url, g.genres,
		       j.duration_seconds, j.log, j.played_at,
		       u.handle, u.name, u.avatar_url, u.color
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id
		JOIN users u ON u.id = j.user_id
		WHERE j.id = $1
	`, id).Scan(
		&j.ID, &j.UserID, &j.IGDBID, &j.GameName, &j.CoverURL, &j.Genres,
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
		SELECT j.id, j.duration_seconds, j.played_at,
		       u.id, u.handle, u.name, u.avatar_url, u.color
		FROM journeys j
		JOIN users u ON u.id = j.user_id
		JOIN src ON j.igdb_id = src.igdb_id AND j.user_id != src.user_id
		ORDER BY j.played_at DESC
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
			&p.JourneyID, &p.DurationSeconds, &p.PlayedAt,
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
				j.id, j.user_id, j.igdb_id, j.duration_seconds, j.log, j.played_at,
				g.name AS game_name, g.cover_url, g.genres,
				u.handle, u.name AS player_name, u.avatar_url, u.color
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			JOIN users u ON u.id = j.user_id
			ORDER BY j.user_id, j.igdb_id, j.played_at DESC
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
			SELECT l.id, l.user_id, l.igdb_id, l.duration_seconds, l.log, l.played_at,
			       l.game_name, l.cover_url, l.genres,
			       l.handle, l.player_name, l.avatar_url, l.color,
			       t.game_rank,
			       ROW_NUMBER() OVER (PARTITION BY l.igdb_id ORDER BY l.played_at DESC) AS entry_rank
			FROM latest_per_player_game l
			JOIN top_games t ON t.igdb_id = l.igdb_id
		)
		SELECT id, user_id, igdb_id, game_name, cover_url, genres,
		       duration_seconds, log, played_at,
		       handle, player_name, avatar_url, color
		FROM ranked_entries
		WHERE entry_rank <= 4
		ORDER BY game_rank, played_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ActivityEntry
	for rows.Next() {
		var e ActivityEntry
		if err := rows.Scan(
			&e.SessionID, &e.UserID, &e.IGDBID, &e.GameName, &e.CoverURL, &e.Genres,
			&e.DurationSeconds, &e.Log, &e.PlayedAt,
			&e.PlayerHandle, &e.PlayerName, &e.PlayerAvatarURL, &e.PlayerColor,
		); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// ListJourneysByUser returns confirmed journeys for the given user ID joined
// with igdb_games, ordered by played_at descending, with optional cursor-based pagination.
func ListJourneysByUser(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string) ([]Journey, error) {
	var rows pgx.Rows
	var err error

	const cols = `
		j.id, j.user_id, j.igdb_id, g.name, g.cover_url, g.genres,
		j.started_at, j.ended_at, j.duration_seconds, j.log, j.played_at, j.created_at`

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			WHERE j.user_id = $1
			ORDER BY j.played_at DESC
			LIMIT $2
		`, userID, limit)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT`+cols+`
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			WHERE j.user_id = $1 AND j.played_at < $2
			ORDER BY j.played_at DESC
			LIMIT $3
		`, userID, cursor, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []Journey
	for rows.Next() {
		var j Journey
		if err := rows.Scan(
			&j.ID, &j.UserID, &j.IGDBID, &j.GameName, &j.CoverURL, &j.Genres,
			&j.StartedAt, &j.EndedAt, &j.DurationSeconds,
			&j.Log, &j.PlayedAt, &j.CreatedAt,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, j)
	}
	return journeys, rows.Err()
}
