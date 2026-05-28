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

// PendingJourney is a row from the pending_journeys table.
type PendingJourney struct {
	ID            string
	DID           string
	Status        string
	IGDBID        *int
	ExeName       *string
	WindowTitle   *string
	StartedAt     time.Time
	EndedAt       *time.Time
	LastHeartbeat time.Time
}

// GetPendingJourney returns a single pending journey by ID and DID.
// Returns an error if it does not exist or does not belong to the given DID.
func GetPendingJourney(ctx context.Context, pool *pgxpool.Pool, id, did string) (PendingJourney, error) {
	var p PendingJourney
	err := pool.QueryRow(ctx, `
		SELECT id, did, status, igdb_id, exe_name, window_title, started_at, ended_at, last_heartbeat
		FROM pending_journeys
		WHERE id = $1 AND did = $2
	`, id, did).Scan(
		&p.ID, &p.DID, &p.Status, &p.IGDBID,
		&p.ExeName, &p.WindowTitle,
		&p.StartedAt, &p.EndedAt, &p.LastHeartbeat,
	)
	if err == pgx.ErrNoRows {
		return PendingJourney{}, fmt.Errorf("pending journey not found: %s", id)
	}
	return p, err
}

// DeletePendingJourney removes a pending journey row. Used after a successful
// AT Proto publish (confirm) or on discard.
func DeletePendingJourney(ctx context.Context, pool *pgxpool.Pool, id, did string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM pending_journeys WHERE id = $1 AND did = $2
	`, id, did)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pending journey not found: %s", id)
	}
	return nil
}

// IndexedJourney is the data written to journeys_index on confirm.
type IndexedJourney struct {
	JourneyURI string
	IGDBID     int
	UserDID    string
	PlayedAt   time.Time
}

// InsertJourneyIndex writes a row to journeys_index. Called after a successful
// AT Proto publish.
func InsertJourneyIndex(ctx context.Context, pool *pgxpool.Pool, j IndexedJourney) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO journeys_index (journey_uri, igdb_id, user_did, played_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (journey_uri) DO NOTHING
	`, j.JourneyURI, j.IGDBID, j.UserDID, j.PlayedAt)
	return err
}

// DeleteJourneyIndex removes a row from journeys_index by AT URI.
func DeleteJourneyIndex(ctx context.Context, pool *pgxpool.Pool, journeyURI, userDID string) error {
	tag, err := pool.Exec(ctx, `
		DELETE FROM journeys_index WHERE journey_uri = $1 AND user_did = $2
	`, journeyURI, userDID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("journey not found in index: %s", journeyURI)
	}
	return nil
}

// ListPendingJourneys returns all pending journeys for the given DID with
// status 'active' or 'ended', ordered by created_at descending.
func ListPendingJourneys(ctx context.Context, pool *pgxpool.Pool, did string) ([]PendingJourney, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, did, status, igdb_id, exe_name, window_title, started_at, ended_at, last_heartbeat
		FROM pending_journeys
		WHERE did = $1 AND status IN ('active', 'ended')
		ORDER BY created_at DESC
	`, did)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []PendingJourney
	for rows.Next() {
		var p PendingJourney
		if err := rows.Scan(
			&p.ID, &p.DID, &p.Status, &p.IGDBID,
			&p.ExeName, &p.WindowTitle,
			&p.StartedAt, &p.EndedAt, &p.LastHeartbeat,
		); err != nil {
			return nil, err
		}
		journeys = append(journeys, p)
	}
	return journeys, rows.Err()
}

// ListJourneysByDID returns journeys_index rows for the given DID, ordered by
// played_at descending, with optional cursor-based pagination.
// cursor is the played_at value of the last item on the previous page (RFC3339).
// Pass empty string for the first page.
func ListJourneysByDID(ctx context.Context, pool *pgxpool.Pool, did string, limit int, cursor string) ([]IndexedJourney, error) {
	var rows pgx.Rows
	var err error

	if cursor == "" {
		rows, err = pool.Query(ctx, `
			SELECT journey_uri, igdb_id, user_did, played_at
			FROM journeys_index
			WHERE user_did = $1
			ORDER BY played_at DESC
			LIMIT $2
		`, did, limit)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT journey_uri, igdb_id, user_did, played_at
			FROM journeys_index
			WHERE user_did = $1 AND played_at < $2
			ORDER BY played_at DESC
			LIMIT $3
		`, did, cursor, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var journeys []IndexedJourney
	for rows.Next() {
		var j IndexedJourney
		if err := rows.Scan(&j.JourneyURI, &j.IGDBID, &j.UserDID, &j.PlayedAt); err != nil {
			return nil, err
		}
		journeys = append(journeys, j)
	}
	return journeys, rows.Err()
}

// GetJourneyURI returns the AT URI for a journey owned by the given DID.
// The rkey is the last segment of the AT URI and is used as the public journey ID.
func GetJourneyURI(ctx context.Context, pool *pgxpool.Pool, rkey, userDID string) (string, error) {
	var uri string
	err := pool.QueryRow(ctx, `
		SELECT journey_uri FROM journeys_index
		WHERE journey_uri LIKE $1 AND user_did = $2
	`, "%/"+rkey, userDID).Scan(&uri)
	if err == pgx.ErrNoRows {
		return "", fmt.Errorf("journey not found: %s", rkey)
	}
	return uri, err
}
