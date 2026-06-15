// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package agent

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

const usersSchema = `
CREATE TABLE IF NOT EXISTS users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    text        NOT NULL,
    provider_id text        NOT NULL,
    handle      text        NOT NULL,
    name        text        NOT NULL,
    avatar_url  text,
    bio         text,
    color       text        NOT NULL DEFAULT '#7c3aed',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);
`

func connectTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	adminDSN := os.Getenv("TEST_DATABASE_ADMIN_URL")
	if dsn == "" || adminDSN == "" {
		t.Fatal("TEST_DATABASE_URL and TEST_DATABASE_ADMIN_URL must be set when running integration tests")
	}

	adminPool, err := db.Connect(context.Background(), adminDSN)
	if err != nil {
		t.Fatalf("connect admin: %v", err)
	}
	defer adminPool.Close()
	if _, err = adminPool.Exec(context.Background(), usersSchema); err != nil {
		t.Fatalf("setup schema: %v", err)
	}

	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect api: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func createTestUser(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, 'testuser', 'Test User')
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, t.Name()).Scan(&id)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	})
	return id
}

// TestAuthenticateBearer_deletedUser verifies that a cryptographically valid
// JWT for a user that no longer exists (account deleted) is rejected with
// 401 — account deletion does not revoke outstanding tokens, so this check
// is what makes a stale agent token useless after deletion.
func TestAuthenticateBearer_deletedUser(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)

	userID := createTestUser(t, pool)
	token, err := auth.CreateSessionJWT(userID, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	// Sanity check: heartbeat succeeds while the user still exists.
	r := httptest.NewRequest(http.MethodPost, "/api/v1/agent/heartbeat", nil)
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.heartbeat(w, r)
	if w.Code != http.StatusNoContent {
		t.Fatalf("heartbeat before deletion: status = %d, want %d", w.Code, http.StatusNoContent)
	}

	if err := db.DeleteUser(context.Background(), pool, userID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	r = httptest.NewRequest(http.MethodPost, "/api/v1/agent/heartbeat", nil)
	r.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	h.heartbeat(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("heartbeat after deletion: status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}
