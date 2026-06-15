// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Command export-user produces a single JSON file containing all data Yurnik
// holds about one user, for fulfilling GDPR right-of-access requests.
//
// Usage:
//
//	go run ./cmd/export-user <handle-or-uuid> [output-file]
//
// If output-file is omitted, the JSON is written to stdout. The tool is
// read-only: it performs no writes and exposes no HTTP endpoint.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/juan-medina/yurnik/internal/db"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("usage: export-user <handle-or-uuid> [output-file]")
	}
	identifier := os.Args[1]

	pool, err := db.Connect(context.Background(), mustEnv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	userID, err := resolveUserID(ctx, pool, identifier)
	if err != nil {
		log.Fatalf("resolve user %q: %v", identifier, err)
	}

	export, err := buildExport(ctx, pool, userID)
	if err != nil {
		log.Fatalf("build export for %s: %v", userID, err)
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		log.Fatalf("marshal export: %v", err)
	}

	if len(os.Args) >= 3 {
		if err := os.WriteFile(os.Args[2], data, 0600); err != nil {
			log.Fatalf("write %s: %v", os.Args[2], err)
		}
		fmt.Printf("export written to %s\n", os.Args[2])
		return
	}

	fmt.Println(string(data))
}

func mustEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("missing required environment variable %s", key)
	}
	return value
}
