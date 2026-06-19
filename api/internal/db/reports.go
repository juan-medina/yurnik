// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EncodeReportCursor encodes a pagination cursor from created_at and report id.
func EncodeReportCursor(createdAt time.Time, id string) string {
	return createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
}

func splitReportCursor(cursor string) (time.Time, string, error) {
	idx := strings.LastIndex(cursor, "|")
	if idx < 0 {
		return time.Time{}, "", fmt.Errorf("invalid report cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, cursor[:idx])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("invalid report cursor time: %w", err)
	}
	return t, cursor[idx+1:], nil
}

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

// InsertReport inserts a new report. Returns ("", false, nil) if the reporter
// has already reported this target (unique constraint), so the caller can
// return 409 without treating it as an error. On success, id is the new row's id.
func InsertReport(ctx context.Context, pool *pgxpool.Pool, reporterID, targetType, targetID string, contextID *string, reason string, note *string) (id string, ok bool, err error) {
	err = pool.QueryRow(ctx, `
		INSERT INTO reports (reporter_id, target_type, target_id, context_id, reason, note)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, reporterID, targetType, targetID, contextID, reason, note).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", false, nil
		}
		return "", false, err
	}
	return id, true, nil
}

// ListReports returns up to limit reports ordered by most recent first.
// cursor (optional) is an opaque token from EncodeReportCursor for keyset pagination.
func ListReports(ctx context.Context, pool *pgxpool.Pool, limit int, cursor string) ([]Report, error) {
	const baseQuery = `
		SELECT r.id, r.reporter_id,
		       u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.color,
		       r.target_type, r.target_id, r.context_id,
		       CASE WHEN r.target_type = 'profile' THEN t.handle END,
		       r.reason, r.note, r.created_at
		FROM reports r
		JOIN users u ON u.id = r.reporter_id
		LEFT JOIN users t ON t.id = r.target_id AND r.target_type = 'profile'
	`
	var rows pgx.Rows
	var err error
	if cursor == "" {
		rows, err = pool.Query(ctx, baseQuery+`
			ORDER BY r.created_at DESC, r.id DESC
			LIMIT $1
		`, limit)
	} else {
		var cursorTime time.Time
		var cursorID string
		cursorTime, cursorID, err = splitReportCursor(cursor)
		if err != nil {
			return nil, fmt.Errorf("list reports: %w", err)
		}
		rows, err = pool.Query(ctx, baseQuery+`
			WHERE (r.created_at, r.id) < ($1, $2)
			ORDER BY r.created_at DESC, r.id DESC
			LIMIT $3
		`, cursorTime, cursorID, limit)
	}
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
