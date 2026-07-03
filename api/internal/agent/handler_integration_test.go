// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

package agent

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

// testUserSeq disambiguates multiple createTestUser calls within the same
// test — t.Name() alone is identical across calls in the same test, which
// would otherwise collide on the (provider, provider_id) unique constraint
// and silently merge two "different" users into one row.
var testUserSeq atomic.Uint64

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
	seq := testUserSeq.Add(1)
	providerID := fmt.Sprintf("%s-%d", t.Name(), seq)
	handle := fmt.Sprintf("testuser%d", seq)
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name)
		VALUES ('test', $1, $2, 'Test User')
		ON CONFLICT (provider, provider_id) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, providerID, handle).Scan(&id)
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

// TestListExclusions_scopedPerUser verifies the exclusions endpoint returns
// only the authenticated user's own exclusions, not another user's.
func TestListExclusions_scopedPerUser(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)
	ctx := context.Background()

	userA := createTestUser(t, pool)
	userB := createTestUser(t, pool)

	if err := db.InsertExclusion(ctx, pool, userA, "discord.exe"); err != nil {
		t.Fatalf("insert exclusion for userA: %v", err)
	}
	if err := db.InsertExclusion(ctx, pool, userB, "obs64.exe"); err != nil {
		t.Fatalf("insert exclusion for userB: %v", err)
	}

	tokenA, err := auth.CreateSessionJWT(userA, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	r := httptest.NewRequest(http.MethodGet, "/api/v1/agent/exclusions", nil)
	r.Header.Set("Authorization", "Bearer "+tokenA)
	w := httptest.NewRecorder()
	h.listExclusions(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Exclusions []string `json:"exclusions"`
	}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Exclusions) != 1 || body.Exclusions[0] != "discord.exe" {
		t.Errorf("exclusions = %v, want [discord.exe]", body.Exclusions)
	}
}

// TestCreatePending_ZeroDurationDiscarded verifies that a pending journey
// with zero or negative duration is discarded (not inserted into DB) and
// returns 200 OK with {"id":"discarded"}.
func TestCreatePending_ZeroDurationDiscarded(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)
	ctx := context.Background()

	userID := createTestUser(t, pool)
	token, err := auth.CreateSessionJWT(userID, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	payload := map[string]string{
		"exe_name":     "game.exe",
		"window_title": "My Game",
		"started_at":   "2026-06-23T12:00:00Z",
		"ended_at":     "2026-06-23T12:00:00Z", // 0 duration
	}
	bodyBytes, _ := json.Marshal(payload)

	r := httptest.NewRequest(http.MethodPost, "/api/v1/agent/pending-journeys", strings.NewReader(string(bodyBytes)))
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.createPending(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.ID != "discarded" {
		t.Errorf("id = %s, want discarded", resp.ID)
	}

	// Verify it was not inserted in the DB.
	// Since database schema is dynamically loaded/available, we can verify that the list is empty.
	// Wait, is pending_journeys table available/created in test schema?
	// The connectTestDB sets up usersSchema. But UpsertPendingJourney tests also run in DB package,
	// and here, the real DB has the full schema migrated.
	journeys, err := db.ListPendingJourneys(ctx, pool, userID)
	if err != nil {
		t.Fatalf("list pending journeys: %v", err)
	}
	if len(journeys) != 0 {
		t.Errorf("got %d pending journeys in database, want 0", len(journeys))
	}
}


func TestCreatePending_AutoConfirm(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)
	ctx := context.Background()

	userID := createTestUser(t, pool)
	token, err := auth.CreateSessionJWT(userID, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	// Setup game and hint
	err = db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID: 999111,
		Name:   "Test Auto Confirm Game",
		Genres: []string{},
	})
	if err != nil {
		t.Fatalf("upsert game: %v", err)
	}
	err = db.UpsertGameHint(ctx, pool, userID, "autoconfirm.exe", 999111)
	if err != nil {
		t.Fatalf("upsert hint: %v", err)
	}

	payload := map[string]string{
		"exe_name":     "autoconfirm.exe",
		"window_title": "My Auto Confirm Game",
		"started_at":   "2026-06-23T12:00:00Z",
		"ended_at":     "2026-06-23T12:02:00Z", // 2 minutes duration
	}
	bodyBytes, _ := json.Marshal(payload)

	r := httptest.NewRequest(http.MethodPost, "/api/v1/agent/pending-journeys", strings.NewReader(string(bodyBytes)))
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.createPending(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	// Verify no pending journeys exist
	pending, err := db.ListPendingJourneys(ctx, pool, userID)
	if err != nil {
		t.Fatalf("list pending journeys: %v", err)
	}
	if len(pending) != 0 {
		t.Errorf("got %d pending journeys, want 0", len(pending))
	}

	// Verify one confirmed journey exists
	journeys, err := db.ListJourneysByUser(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	if len(journeys) != 1 {
		t.Errorf("got %d journeys, want 1", len(journeys))
	} else {
		if journeys[0].IGDBID != 999111 {
			t.Errorf("journey IGDBID = %d, want 999111", journeys[0].IGDBID)
		}
		if journeys[0].DurationSeconds != 120 {
			t.Errorf("journey DurationSeconds = %d, want 120", journeys[0].DurationSeconds)
		}
	}
}

func TestCreatePending_AutoConfirm_ShortDuration(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)
	ctx := context.Background()

	userID := createTestUser(t, pool)
	token, err := auth.CreateSessionJWT(userID, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	// Setup game and hint
	err = db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID: 999222,
		Name:   "Test Auto Confirm Short Game",
		Genres: []string{},
	})
	if err != nil {
		t.Fatalf("upsert game: %v", err)
	}
	err = db.UpsertGameHint(ctx, pool, userID, "short.exe", 999222)
	if err != nil {
		t.Fatalf("upsert hint: %v", err)
	}

	payload := map[string]string{
		"exe_name":     "short.exe",
		"window_title": "My Short Game",
		"started_at":   "2026-06-23T12:00:00Z",
		"ended_at":     "2026-06-23T12:00:30Z", // 30 seconds duration
	}
	bodyBytes, _ := json.Marshal(payload)

	r := httptest.NewRequest(http.MethodPost, "/api/v1/agent/pending-journeys", strings.NewReader(string(bodyBytes)))
	r.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.createPending(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	// Verify no pending journeys exist
	pending, err := db.ListPendingJourneys(ctx, pool, userID)
	if err != nil {
		t.Fatalf("list pending journeys: %v", err)
	}
	if len(pending) != 0 {
		t.Errorf("got %d pending journeys, want 0", len(pending))
	}

	// Verify NO confirmed journey exists
	journeys, err := db.ListJourneysByUser(ctx, pool, userID, 10, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	if len(journeys) != 0 {
		t.Errorf("got %d journeys, want 0", len(journeys))
	}
}

func TestListInclusions_scopedPerUser(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	h := NewHandler(pool, jwtPriv)
	ctx := context.Background()

	userA := createTestUser(t, pool)
	userB := createTestUser(t, pool)

	if err := db.InsertInclusion(ctx, pool, userA, "awesomegame.exe"); err != nil {
		t.Fatalf("insert inclusion for userA: %v", err)
	}
	if err := db.InsertInclusion(ctx, pool, userB, "othergame.exe"); err != nil {
		t.Fatalf("insert inclusion for userB: %v", err)
	}

	tokenA, err := auth.CreateSessionJWT(userA, jwtPriv)
	if err != nil {
		t.Fatalf("create session jwt: %v", err)
	}

	r := httptest.NewRequest(http.MethodGet, "/api/v1/agent/inclusions", nil)
	r.Header.Set("Authorization", "Bearer "+tokenA)
	w := httptest.NewRecorder()
	h.listInclusions(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Inclusions []string `json:"inclusions"`
	}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Inclusions) != 1 || body.Inclusions[0] != "awesomegame.exe" {
		t.Errorf("inclusions = %v, want [awesomegame.exe]", body.Inclusions)
	}
}
