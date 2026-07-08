// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package notifications

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

func TestHandlerListNotificationsWithBacklogRelease(t *testing.T) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Fatal("TEST_DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Seed data
	pool.Exec(ctx, "DELETE FROM users WHERE provider_id = 'notifications_test_u1'")
	pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = 999993")

	var userID string
	err = pool.QueryRow(ctx, "INSERT INTO users (provider, provider_id, handle, name) VALUES ('test', 'notifications_test_u1', 'notificationu1', 'Notification U1') RETURNING id").Scan(&userID)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	_, err = pool.Exec(ctx, "INSERT INTO igdb_games (igdb_id, name, cover_url, genres) VALUES (999993, 'Test Game 3', '', '{}')")
	if err != nil {
		t.Fatalf("insert game: %v", err)
	}

	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", userID)
		pool.Exec(ctx, "DELETE FROM igdb_games WHERE igdb_id = 999993")
	})

	// Insert a notification
	_, err = pool.Exec(ctx, "INSERT INTO notifications (recipient_id, type, subject_igdb_id, updated_at, batch_until) VALUES ($1, 'backlog_release', 999993, now(), now())", userID)
	if err != nil {
		t.Fatalf("insert notification: %v", err)
	}

	// Make request
	_, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	h := NewHandler(pool, priv)

	token, _ := auth.CreateSessionJWT(userID, priv)

	req := httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	h.list(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var result struct {
		Notifications []notificationResp `json:"notifications"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(result.Notifications) == 0 {
		t.Fatal("expected notifications, got 0")
	}

	notification := result.Notifications[0]
	if notification.Type != "backlog_release" {
		t.Errorf("expected backlog_release, got %s", notification.Type)
	}
	if notification.SubjectIgdbID == nil || *notification.SubjectIgdbID != 999993 {
		t.Errorf("expected SubjectIgdbID 999993, got %v", notification.SubjectIgdbID)
	}
}
