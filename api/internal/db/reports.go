// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Report is a row from the reports table joined with the reporter's handle.
// TargetHandle is set for user-target types (bio, avatar, display_name) so
// the admin UI can build a /player/:handle link without a second lookup.
type Report struct {
	ID              string
	ReporterID      string
	ReporterHandle  string
	ReporterName    string
	ReporterAvatar  *string
	ReporterColor   string
	TargetType      string
	TargetID        string
	ContextID       *string
	TargetHandle    *string
	Reason          string
	Note            *string
	CreatedAt       time.Time
}

// InsertReport inserts a new report. Returns (false, nil) if the reporter
// has already reported this target (unique constraint), so the caller can
// return 409 without treating it as an error.
func InsertReport(ctx context.Context, pool *pgxpool.Pool, reporterID, targetType, targetID string, contextID *string, reason string, note *string) (bool, error) {
	_, err := pool.Exec(ctx, `
		INSERT INTO reports (reporter_id, target_type, target_id, context_id, reason, note)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, reporterID, targetType, targetID, contextID, reason, note)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ListReports returns all reports ordered by most recent first, joined with
// the reporter's handle for display in the admin UI.
func ListReports(ctx context.Context, pool *pgxpool.Pool) ([]Report, error) {
	rows, err := pool.Query(ctx, `
		SELECT r.id, r.reporter_id,
		       u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color,
		       r.target_type, r.target_id, r.context_id,
		       CASE WHEN r.target_type = 'profile' THEN t.handle END,
		       r.reason, r.note, r.created_at
		FROM reports r
		JOIN users u ON u.id = r.reporter_id
		LEFT JOIN users t ON t.id = r.target_id AND r.target_type = 'profile'
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []Report
	for rows.Next() {
		var rep Report
		if err := rows.Scan(&rep.ID, &rep.ReporterID, &rep.ReporterHandle, &rep.ReporterName, &rep.ReporterAvatar, &rep.ReporterColor, &rep.TargetType, &rep.TargetID, &rep.ContextID, &rep.TargetHandle, &rep.Reason, &rep.Note, &rep.CreatedAt); err != nil {
			return nil, err
		}
		reports = append(reports, rep)
	}
	return reports, rows.Err()
}
