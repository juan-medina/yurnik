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

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
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

	if err := evictData(ctx, pool); err != nil {
		return err
	}

	log.Println("Maintenance job completed successfully.")
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

	// 2. Evict echoes older than 60 days
	res, err = pool.Exec(ctx, `
		DELETE FROM echoes 
		WHERE updated_at < NOW() - INTERVAL '60 days'
	`)
	if err != nil {
		return fmt.Errorf("delete old echoes: %w", err)
	}
	log.Printf("Evicted %d echoes older than 60 days", res.RowsAffected())

	return nil
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("missing required environment variable %s", key)
	}
	return value
}
