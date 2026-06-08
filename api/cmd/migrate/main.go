// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Command migrate applies versioned schema migrations to the database.
//
// It relies on the database and roles already existing (see `make db-init`)
// and connects as yurnik_admin via DATABASE_ADMIN_URL, since applying
// migrations requires DDL rights that yurnik_api does not have.
//
// Usage:
//
//	go run ./cmd/migrate up        # apply all pending migrations (default)
//	go run ./cmd/migrate version   # print the current schema version
package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/juan-medina/yurnik/internal/migrations"
)

func main() {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	m, err := newMigrator(mustEnv("DATABASE_ADMIN_URL"))
	if err != nil {
		log.Fatalf("migrate: %v", err)
	}

	switch cmd {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Fatalf("migrate up: %v", err)
		}
		fmt.Println("migrate: schema is up to date")
	case "version":
		version, dirty, err := m.Version()
		if err != nil {
			log.Fatalf("migrate version: %v", err)
		}
		fmt.Printf("version=%d dirty=%t\n", version, dirty)
	default:
		log.Fatalf("migrate: unknown command %q (want \"up\" or \"version\")", cmd)
	}
}

func newMigrator(databaseURL string) (*migrate.Migrate, error) {
	source, err := iofs.New(migrations.Files, ".")
	if err != nil {
		return nil, fmt.Errorf("load migration source: %w", err)
	}

	return migrate.NewWithSourceInstance("iofs", source, withoutSSL(databaseURL))
}

// withoutSSL appends sslmode=disable when the URL doesn't already specify one.
// Postgres runs on the same host as the API (dev and production alike, see
// docs/DEPLOYMENT.md) with SSL not enabled -- lib/pq otherwise defaults to
// "require" and refuses to connect.
func withoutSSL(databaseURL string) string {
	if strings.Contains(databaseURL, "sslmode=") {
		return databaseURL
	}
	separator := "?"
	if strings.Contains(databaseURL, "?") {
		separator = "&"
	}
	return databaseURL + separator + "sslmode=disable"
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("missing required environment variable %s", key)
	}
	return value
}
