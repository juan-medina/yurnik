// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package auth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

func connectTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Fatal("TEST_DATABASE_URL must be set when running integration tests")
	}
	pool, err := db.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
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
		VALUES ('test', $1, 'auth_testuser', 'Auth Test User')
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

func newTestHandlerWithDB(t *testing.T, pool *pgxpool.Pool) *Handler {
	t.Helper()
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	return NewHandler(jwtPriv, pool, Config{FrontendURL: "http://localhost"})
}

// TestSession_success verifies that a completed OAuth state results in a signed
// session JWT cookie and that the state is consumed on use.
func TestSession_success(t *testing.T) {
	pool := connectTestDB(t)
	h := newTestHandlerWithDB(t, pool)
	userID := createTestUser(t, pool)

	h.store.put("state1", "verifier", time.Minute)
	h.store.setUserID("state1", userID)

	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w := httptest.NewRecorder()
	h.session(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var sessionCookie *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == "yurnik_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || strings.TrimSpace(sessionCookie.Value) == "" {
		t.Error("yurnik_session cookie missing or empty")
	}

	// State must be consumed — a second call with the same cookie must fail.
	r2 := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r2.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w2 := httptest.NewRecorder()
	h.session(w2, r2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("second session call: status = %d, want %d", w2.Code, http.StatusBadRequest)
	}
}

// TestSession_suspended verifies that a suspended user cannot complete login.
func TestSession_suspended(t *testing.T) {
	pool := connectTestDB(t)
	h := newTestHandlerWithDB(t, pool)
	userID := createTestUser(t, pool)

	if err := db.SuspendUser(context.Background(), pool, userID); err != nil {
		t.Fatalf("suspend user: %v", err)
	}

	h.store.put("state1", "verifier", time.Minute)
	h.store.setUserID("state1", userID)

	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w := httptest.NewRecorder()
	h.session(w, r)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
	}
}
