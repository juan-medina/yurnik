// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Command maintenance performs daily data eviction.
//
// It is designed to be run as a cron job or systemd timer. It connects to the
// database and deletes old data according to the project's retention policy.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
	"github.com/juan-medina/yurnik/internal/games"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("maintenance failed: %v", err)
	}
}

func run() error {
	ctx := context.Background()
	pool, err := db.Connect(ctx, mustEnv("DATABASE_URL"))
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}
	defer pool.Close()

	log.Println("Running maintenance job...")

	igdbClient := games.NewClient(mustEnv("IGDB_CLIENT_ID"), mustEnv("IGDB_CLIENT_SECRET"))

	if err := evictData(ctx, pool); err != nil {
		return err
	}

	if err := refreshUpcomingReleases(ctx, pool, igdbClient); err != nil {
		return err
	}

	log.Println("Maintenance job completed successfully.")
	return nil
}

type IGDBReleaseFetcher interface {
	GetBatchReleaseDates(ctx context.Context, igdbIDs []int) (map[int]*time.Time, error)
}

func refreshUpcomingReleases(ctx context.Context, pool *pgxpool.Pool, igdbClient IGDBReleaseFetcher) error {
	log.Println("Refreshing upcoming releases in backlog...")

	// Find games in backlog that need refresh (no release date, or release date >= 1 year ago)
	rows, err := pool.Query(ctx, `
		SELECT DISTINCT h.igdb_id 
		FROM backlog_entries h
		JOIN igdb_games g ON h.igdb_id = g.igdb_id
		WHERE g.release_date IS NULL OR g.release_date >= NOW() - INTERVAL '1 year'
	`)
	if err != nil {
		return fmt.Errorf("query games to refresh: %w", err)
	}

	var igdbIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("scan igdb_id: %w", err)
		}
		igdbIDs = append(igdbIDs, id)
	}
	rows.Close()

	log.Printf("Found %d games to refresh", len(igdbIDs))

	// Fetch in batches of 500
	for i := 0; i < len(igdbIDs); i += 500 {
		end := i + 500
		if end > len(igdbIDs) {
			end = len(igdbIDs)
		}
		batch := igdbIDs[i:end]

		dates, err := igdbClient.GetBatchReleaseDates(ctx, batch)
		if err != nil {
			return fmt.Errorf("fetch batch release dates: %w", err)
		}

		// Update database
		for igdbID, date := range dates {
			var err error
			if date == nil {
				_, err = pool.Exec(ctx, `UPDATE igdb_games SET cached_at = NOW() WHERE igdb_id = $1`, igdbID)
			} else {
				y := date.Year()
				_, err = pool.Exec(ctx, `
					UPDATE igdb_games SET release_date = $1, release_year = $2, cached_at = NOW() WHERE igdb_id = $3
				`, date, y, igdbID)
			}
			if err != nil {
				return fmt.Errorf("update igdb_games: %w", err)
			}
		}
	}

	// Insert new backlog_release notifications
	res, err := pool.Exec(ctx, `
		INSERT INTO notifications (recipient_id, type, subject_igdb_id, subject_title, batch_until)
		SELECT h.player_id, 'backlog_release', h.igdb_id, g.name, NOW()
		FROM backlog_entries h
		JOIN igdb_games g ON h.igdb_id = g.igdb_id
		WHERE g.release_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
		AND NOT EXISTS (
			SELECT 1 FROM notifications e
			WHERE e.recipient_id = h.player_id 
			  AND e.subject_igdb_id = h.igdb_id 
			  AND e.type = 'backlog_release'
		)
	`)
	if err != nil {
		return fmt.Errorf("insert backlog_release notifications: %w", err)
	}
	
	log.Printf("Created %d new backlog_release notifications", res.RowsAffected())
	return nil
}

func evictData(ctx context.Context, pool *pgxpool.Pool) error {
	// 1. Evict pending journeys older than 30 days
	res, err := pool.Exec(ctx, `
		DELETE FROM pending_journeys 
		WHERE created_at < NOW() - INTERVAL '30 days'
	`)
	if err != nil {
		return fmt.Errorf("delete pending journeys: %w", err)
	}
	log.Printf("Evicted %d pending journeys older than 30 days", res.RowsAffected())

	// 2. Evict notifications older than 60 days
	res, err = pool.Exec(ctx, `
		DELETE FROM notifications 
		WHERE updated_at < NOW() - INTERVAL '60 days'
	`)
	if err != nil {
		return fmt.Errorf("delete old notifications: %w", err)
	}
	log.Printf("Evicted %d notifications older than 60 days", res.RowsAffected())

	return nil
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("missing required environment variable %s", key)
	}
	return value
}
