// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package db_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

func insertTestJourney(t *testing.T, pool *pgxpool.Pool, id string, userID string, igdbID int, playedAt time.Time, duration int) {
	t.Helper()
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
		INSERT INTO journeys (id, user_id, igdb_id, started_at, ended_at, duration_seconds, played_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, userID, igdbID, playedAt, playedAt, duration, playedAt)
	if err != nil {
		t.Fatalf("insert journey: %v", err)
	}
	t.Cleanup(func() { pool.Exec(ctx, "DELETE FROM journeys WHERE id = $1", id) })
}

func TestGetPlayerGames_Pagination(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	userID := createTestUser(t, pool)

	// Create 3 games
	insertTestGame(t, pool, 100, "Game A")
	insertTestGame(t, pool, 200, "Game B")
	insertTestGame(t, pool, 300, "Game C")

	// Insert journeys for each game
	// We insert them so that they have different LastPlayed times.
	baseTime := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	insertTestJourney(t, pool, "11111111-1111-1111-1111-111111111111", userID, 100, baseTime.Add(1*time.Hour), 3600) // Game A
	insertTestJourney(t, pool, "22222222-2222-2222-2222-222222222222", userID, 200, baseTime.Add(2*time.Hour), 3600) // Game B
	insertTestJourney(t, pool, "33333333-3333-3333-3333-333333333333", userID, 300, baseTime.Add(3*time.Hour), 3600) // Game C

	// First page: limit 2
	games, err := db.GetPlayerGames(ctx, pool, userID, 2, "", "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(games) != 2 {
		t.Fatalf("expected 2 games, got %d", len(games))
	}

	// Should be ordered by LastPlayed DESC: Game C, then Game B
	if games[0].IGDBID != 300 || games[1].IGDBID != 200 {
		t.Errorf("expected games [300, 200], got [%d, %d]", games[0].IGDBID, games[1].IGDBID)
	}

	// Get next page
	cursor := db.EncodeGameCursor(games[1].LastPlayed, games[1].IGDBID)
	nextPage, err := db.GetPlayerGames(ctx, pool, userID, 2, cursor, "", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(nextPage) != 1 {
		t.Fatalf("expected 1 game on page 2, got %d", len(nextPage))
	}

	if nextPage[0].IGDBID != 100 {
		t.Errorf("expected game 100, got %d", nextPage[0].IGDBID)
	}
}

func TestGetPlayerGames_Filter(t *testing.T) {
	pool := connectTestDB(t)
	ctx := context.Background()

	userID := createTestUser(t, pool)

	// Create games, some with genres
	insertTestGame(t, pool, 101, "Super Mario RPG")
	insertTestGame(t, pool, 102, "Super Metroid")
	insertTestGame(t, pool, 103, "Halo")

	// Manually set genres since createTestGame doesn't expose it
	_, err := pool.Exec(ctx, `UPDATE igdb_games SET genres = '{"RPG", "Platformer"}' WHERE igdb_id = 101`)
	if err != nil {
		t.Fatalf("update genres: %v", err)
	}
	_, err = pool.Exec(ctx, `UPDATE igdb_games SET genres = '{"Platformer", "Adventure"}' WHERE igdb_id = 102`)
	if err != nil {
		t.Fatalf("update genres: %v", err)
	}

	baseTime := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
	insertTestJourney(t, pool, "11111111-1111-1111-1111-111111111111", userID, 101, baseTime, 3600)
	insertTestJourney(t, pool, "22222222-2222-2222-2222-222222222222", userID, 102, baseTime, 3600)
	insertTestJourney(t, pool, "33333333-3333-3333-3333-333333333333", userID, 103, baseTime, 3600)

	tests := []struct {
		name     string
		q        string
		genre    string
		expected []int // igdb_ids
	}{
		{
			name:     "search by exact name",
			q:        "Halo",
			genre:    "",
			expected: []int{103},
		},
		{
			name:     "search by partial name case insensitive",
			q:        "super m",
			genre:    "",
			expected: []int{102, 101}, // 102 and 101 have same timestamp, order by ID DESC -> 103, 102, 101
		},
		{
			name:     "filter by genre",
			q:        "",
			genre:    "Platformer",
			expected: []int{102, 101},
		},
		{
			name:     "filter by genre and search",
			q:        "RPG",
			genre:    "RPG",
			expected: []int{101},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			games, err := db.GetPlayerGames(ctx, pool, userID, 10, "", tc.q, tc.genre)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			
			if len(games) != len(tc.expected) {
				t.Fatalf("expected %d games, got %d", len(tc.expected), len(games))
			}

			for i, exp := range tc.expected {
				if games[i].IGDBID != exp {
					t.Errorf("at index %d expected IGDBID %d, got %d", i, exp, games[i].IGDBID)
				}
			}
		})
	}
}
