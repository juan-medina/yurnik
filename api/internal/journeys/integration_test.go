// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

//go:build integration

// Integration tests for the journey confirm + delete flow.
// Requires a real Postgres (DATABASE_URL) and two Bluesky sandbox accounts.
// Run via: make test-integration
package journeys

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/juan-medina/agon/internal/atproto"
	"github.com/juan-medina/agon/internal/auth"
	"github.com/juan-medina/agon/internal/db"
)

func requireEnv(t *testing.T, key string) string {
	t.Helper()
	v := os.Getenv(key)
	if v == "" {
		t.Fatalf("required env var not set: %s", key)
	}
	return v
}

type testUser struct {
	Handle      string
	DID         string
	AccessToken string
}

func setupUser(t *testing.T, ctx context.Context, pds, handle, appPassword string) testUser {
	t.Helper()
	accessToken, err := auth.CreateSessionWithAppPassword(ctx, pds, handle, appPassword)
	if err != nil {
		t.Fatalf("create session for %s: %v", handle, err)
	}
	did, err := resolveDID(ctx, pds, handle)
	if err != nil {
		t.Fatalf("resolve DID for %s: %v", handle, err)
	}
	return testUser{Handle: handle, DID: did, AccessToken: accessToken}
}

func TestIntegration_ConfirmAndDelete(t *testing.T) {
	pds := requireEnv(t, "ATP_TEST_PDS")
	handle1 := requireEnv(t, "ATP_TEST_HANDLE_1")
	appPassword1 := requireEnv(t, "ATP_TEST_APP_PASSWORD_1")
	dsn := requireEnv(t, "DATABASE_URL")

	ctx := context.Background()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	user1 := setupUser(t, ctx, pds, handle1, appPassword1)

	if err := db.UpsertUser(ctx, pool, user1.DID); err != nil {
		t.Fatalf("upsert user: %v", err)
	}

	const testIGDBID = 119133
	if err := db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID:   testIGDBID,
		Name:     "Elden Ring",
		CoverURL: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
		Genres:   []string{"RPG", "Soulslike"},
	}); err != nil {
		t.Fatalf("upsert game: %v", err)
	}

	var pendingID string
	now := time.Now().UTC()
	endedAt := now.Add(-1 * time.Hour)
	err = pool.QueryRow(ctx, `
		INSERT INTO pending_journeys (did, status, igdb_id, started_at, ended_at, last_heartbeat)
		VALUES ($1, 'ended', $2, $3, $4, $5)
		RETURNING id
	`, user1.DID, testIGDBID, now.Add(-2*time.Hour), endedAt, now).Scan(&pendingID)
	if err != nil {
		t.Fatalf("insert pending journey: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM pending_journeys WHERE id = $1`, pendingID)
	})

	atp := atproto.New(pds, nil, nil)
	game, err := db.GetGame(ctx, pool, testIGDBID)
	if err != nil {
		t.Fatalf("get game: %v", err)
	}

	logText := "Integration test journey — safe to delete."
	rec := journeyRecord{
		Type:            "app.agon.journey",
		IGDBID:          game.IGDBID,
		GameTitle:       game.Name,
		Genres:          game.Genres,
		DurationSeconds: int(endedAt.Sub(now.Add(-2 * time.Hour)).Seconds()),
		StartedAt:       now.Add(-2 * time.Hour).Format(time.RFC3339),
		EndedAt:         endedAt.Format(time.RFC3339),
		Log:             &logText,
	}
	if game.CoverURL != "" {
		rec.CoverURL = &game.CoverURL
	}

	result, err := atp.CreateRecord(ctx, user1.AccessToken, atproto.Record{
		Collection: "app.agon.journey",
		Repo:       user1.DID,
		Record:     rec,
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	t.Logf("created journey: %s (cid: %s)", result.URI, result.CID)

	if !strings.HasPrefix(result.URI, "at://") {
		t.Errorf("URI = %q, want at:// prefix", result.URI)
	}
	if !strings.Contains(result.URI, "app.agon.journey") {
		t.Errorf("URI = %q, want app.agon.journey collection", result.URI)
	}

	if err := db.InsertJourneyIndex(ctx, pool, db.IndexedJourney{
		JourneyURI: result.URI,
		IGDBID:     testIGDBID,
		UserDID:    user1.DID,
		PlayedAt:   endedAt,
	}); err != nil {
		t.Fatalf("insert journey index: %v", err)
	}

	if err := db.DeletePendingJourney(ctx, pool, pendingID, user1.DID); err != nil {
		t.Fatalf("delete pending journey: %v", err)
	}

	var count int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM pending_journeys WHERE id = $1`, pendingID).Scan(&count)
	if count != 0 {
		t.Errorf("pending row still exists after confirm")
	}
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM journeys_index WHERE journey_uri = $1`, result.URI).Scan(&count)
	if count != 1 {
		t.Errorf("journeys_index row missing after confirm")
	}

	if err := atp.DeleteRecord(ctx, user1.AccessToken, result.URI); err != nil {
		t.Fatalf("DeleteRecord: %v", err)
	}
	if err := db.DeleteJourneyIndex(ctx, pool, result.URI, user1.DID); err != nil {
		t.Fatalf("delete journey index: %v", err)
	}
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM journeys_index WHERE journey_uri = $1`, result.URI).Scan(&count)
	if count != 0 {
		t.Errorf("journeys_index row still exists after delete")
	}
	t.Logf("journey confirmed and deleted cleanly")
}

func TestIntegration_ListPendingAndExclude(t *testing.T) {
	pds := requireEnv(t, "ATP_TEST_PDS")
	handle1 := requireEnv(t, "ATP_TEST_HANDLE_1")
	appPassword1 := requireEnv(t, "ATP_TEST_APP_PASSWORD_1")
	dsn := requireEnv(t, "DATABASE_URL")

	ctx := context.Background()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	user1 := setupUser(t, ctx, pds, handle1, appPassword1)
	if err := db.UpsertUser(ctx, pool, user1.DID); err != nil {
		t.Fatalf("upsert user: %v", err)
	}

	const testIGDBID = 119133
	if err := db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID:   testIGDBID,
		Name:     "Elden Ring",
		CoverURL: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
		Genres:   []string{"RPG", "Soulslike"},
	}); err != nil {
		t.Fatalf("upsert game: %v", err)
	}

	exeName := "eldenring.exe"
	var pendingID string
	now := time.Now().UTC()
	err = pool.QueryRow(ctx, `
		INSERT INTO pending_journeys (did, status, igdb_id, exe_name, window_title, started_at, ended_at, last_heartbeat)
		VALUES ($1, 'ended', $2, $3, 'ELDEN RING', $4, $5, $6)
		RETURNING id
	`, user1.DID, testIGDBID, exeName, now.Add(-2*time.Hour), now.Add(-1*time.Hour), now).Scan(&pendingID)
	if err != nil {
		t.Fatalf("insert pending journey: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM pending_journeys WHERE id = $1`, pendingID)
		_, _ = pool.Exec(ctx, `DELETE FROM exe_exclusions WHERE did = $1 AND exe_name = $2`, user1.DID, exeName)
	})

	pending, err := db.ListPendingJourneys(ctx, pool, user1.DID)
	if err != nil {
		t.Fatalf("list pending: %v", err)
	}
	found := false
	for _, p := range pending {
		if p.ID == pendingID {
			found = true
		}
	}
	if !found {
		t.Errorf("pending journey %s not found in list", pendingID)
	}

	if err := db.InsertExclusion(ctx, pool, user1.DID, exeName); err != nil {
		t.Fatalf("insert exclusion: %v", err)
	}
	if err := db.DeletePendingJourney(ctx, pool, pendingID, user1.DID); err != nil {
		t.Fatalf("delete pending after exclude: %v", err)
	}

	var count int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM pending_journeys WHERE id = $1`, pendingID).Scan(&count)
	if count != 0 {
		t.Errorf("pending row still exists after exclude")
	}
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM exe_exclusions WHERE did = $1 AND exe_name = $2`, user1.DID, exeName).Scan(&count)
	if count != 1 {
		t.Errorf("exclusion row missing after exclude")
	}
	t.Logf("list and exclude flow passed cleanly")
}

func TestIntegration_ListConfirmedJourneys(t *testing.T) {
	pds := requireEnv(t, "ATP_TEST_PDS")
	handle1 := requireEnv(t, "ATP_TEST_HANDLE_1")
	appPassword1 := requireEnv(t, "ATP_TEST_APP_PASSWORD_1")
	dsn := requireEnv(t, "DATABASE_URL")

	ctx := context.Background()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	user1 := setupUser(t, ctx, pds, handle1, appPassword1)
	if err := db.UpsertUser(ctx, pool, user1.DID); err != nil {
		t.Fatalf("upsert user: %v", err)
	}

	const testIGDBID = 119133
	if err := db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID:   testIGDBID,
		Name:     "Elden Ring",
		CoverURL: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
		Genres:   []string{"RPG", "Soulslike"},
	}); err != nil {
		t.Fatalf("upsert game: %v", err)
	}

	atp := atproto.New(pds, nil, nil)
	now := time.Now().UTC()
	endedAt := now.Add(-1 * time.Hour)
	logText := "Integration test — list confirmed journeys."
	game, err := db.GetGame(ctx, pool, testIGDBID)
	if err != nil {
		t.Fatalf("get game: %v", err)
	}

	rec := journeyRecord{
		Type:            "app.agon.journey",
		IGDBID:          game.IGDBID,
		GameTitle:       game.Name,
		Genres:          game.Genres,
		DurationSeconds: int(endedAt.Sub(now.Add(-2 * time.Hour)).Seconds()),
		StartedAt:       now.Add(-2 * time.Hour).Format(time.RFC3339),
		EndedAt:         endedAt.Format(time.RFC3339),
		Log:             &logText,
	}
	if game.CoverURL != "" {
		rec.CoverURL = &game.CoverURL
	}

	result, err := atp.CreateRecord(ctx, user1.AccessToken, atproto.Record{
		Collection: "app.agon.journey",
		Repo:       user1.DID,
		Record:     rec,
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	t.Cleanup(func() {
		_ = atp.DeleteRecord(ctx, user1.AccessToken, result.URI)
		_, _ = pool.Exec(ctx, `DELETE FROM journeys_index WHERE journey_uri = $1`, result.URI)
	})

	if err := db.InsertJourneyIndex(ctx, pool, db.IndexedJourney{
		JourneyURI: result.URI,
		IGDBID:     testIGDBID,
		UserDID:    user1.DID,
		PlayedAt:   endedAt,
	}); err != nil {
		t.Fatalf("insert journey index: %v", err)
	}

	journeys, err := db.ListJourneysByDID(ctx, pool, user1.DID, 20, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	found := false
	for _, j := range journeys {
		if j.JourneyURI == result.URI {
			found = true
		}
	}
	if !found {
		t.Errorf("journey %s not found in list", result.URI)
	}
	t.Logf("list confirmed journeys passed cleanly")
}

func TestIntegration_AddJourney(t *testing.T) {
	pds := requireEnv(t, "ATP_TEST_PDS")
	handle1 := requireEnv(t, "ATP_TEST_HANDLE_1")
	appPassword1 := requireEnv(t, "ATP_TEST_APP_PASSWORD_1")
	dsn := requireEnv(t, "DATABASE_URL")

	ctx := context.Background()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	user1 := setupUser(t, ctx, pds, handle1, appPassword1)
	if err := db.UpsertUser(ctx, pool, user1.DID); err != nil {
		t.Fatalf("upsert user: %v", err)
	}

	const testIGDBID = 119133
	if err := db.UpsertGame(ctx, pool, db.CachedGame{
		IGDBID:   testIGDBID,
		Name:     "Elden Ring",
		CoverURL: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
		Genres:   []string{"RPG", "Soulslike"},
	}); err != nil {
		t.Fatalf("upsert game: %v", err)
	}

	atp := atproto.New(pds, nil, nil)
	now := time.Now().UTC()
	playedAt := now.Add(-1 * time.Hour)
	durationSeconds := 3600
	logText := "Integration test — direct add journey."
	game, err := db.GetGame(ctx, pool, testIGDBID)
	if err != nil {
		t.Fatalf("get game: %v", err)
	}

	startedAt := playedAt.Add(-time.Duration(durationSeconds) * time.Second)
	rec := journeyRecord{
		Type:            "app.agon.journey",
		IGDBID:          game.IGDBID,
		GameTitle:       game.Name,
		Genres:          game.Genres,
		DurationSeconds: durationSeconds,
		StartedAt:       startedAt.UTC().Format(time.RFC3339),
		EndedAt:         playedAt.UTC().Format(time.RFC3339),
		Log:             &logText,
	}
	if game.CoverURL != "" {
		rec.CoverURL = &game.CoverURL
	}

	result, err := atp.CreateRecord(ctx, user1.AccessToken, atproto.Record{
		Collection: "app.agon.journey",
		Repo:       user1.DID,
		Record:     rec,
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	t.Logf("added journey: %s", result.URI)

	t.Cleanup(func() {
		_ = atp.DeleteRecord(ctx, user1.AccessToken, result.URI)
		_, _ = pool.Exec(ctx, `DELETE FROM journeys_index WHERE journey_uri = $1`, result.URI)
	})

	if err := db.InsertJourneyIndex(ctx, pool, db.IndexedJourney{
		JourneyURI: result.URI,
		IGDBID:     testIGDBID,
		UserDID:    user1.DID,
		PlayedAt:   playedAt,
	}); err != nil {
		t.Fatalf("insert journey index: %v", err)
	}

	journeys, err := db.ListJourneysByDID(ctx, pool, user1.DID, 20, "")
	if err != nil {
		t.Fatalf("list journeys: %v", err)
	}
	found := false
	for _, j := range journeys {
		if j.JourneyURI == result.URI {
			found = true
		}
	}
	if !found {
		t.Errorf("journey %s not found in list after add", result.URI)
	}
	t.Logf("add journey passed cleanly")
}

func resolveDID(ctx context.Context, pds, handle string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		pds+"/xrpc/com.atproto.identity.resolveHandle?handle="+handle, nil)
	if err != nil {
		return "", fmt.Errorf("resolve did: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("resolve did: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		DID string `json:"did"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("resolve did decode: %w", err)
	}
	if result.DID == "" {
		return "", fmt.Errorf("resolve did: empty DID for handle %s", handle)
	}
	return result.DID, nil
}
