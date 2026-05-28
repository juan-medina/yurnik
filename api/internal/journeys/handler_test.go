// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package journeys

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDiscard_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/pending-journeys/some-id/discard", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestConfirm_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/pending-journeys/some-id/confirm",
		strings.NewReader(`{"igdb_id":1}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestDelete_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodDelete, "/api/journeys/some-id", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

// TestJourneyRecord_serialisation verifies that journeyRecord marshals to the
// shape the AT Proto PDS expects — $type present, optional fields omitted when nil.
func TestJourneyRecord_serialisation(t *testing.T) {
	rec := journeyRecord{
		Type:            "app.agon.journey",
		IGDBID:          119133,
		GameTitle:       "Elden Ring",
		Genres:          []string{"RPG", "Soulslike"},
		DurationSeconds: 11640,
		StartedAt:       "2026-05-23T10:00:00Z",
		EndedAt:         "2026-05-23T13:14:00Z",
	}

	b, err := json.Marshal(rec)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out["$type"] != "app.agon.journey" {
		t.Errorf("$type = %v, want app.agon.journey", out["$type"])
	}
	if _, ok := out["coverUrl"]; ok {
		t.Error("coverUrl should be omitted when nil")
	}
	if _, ok := out["log"]; ok {
		t.Error("log should be omitted when nil")
	}
	if out["igdbId"] != float64(119133) {
		t.Errorf("igdbId = %v, want 119133", out["igdbId"])
	}
	if out["durationSeconds"] != float64(11640) {
		t.Errorf("durationSeconds = %v, want 11640", out["durationSeconds"])
	}
}

func TestListPending_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodGet, "/api/pending-journeys", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestListByPlayer_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodGet, "/api/players/some.handle/journeys", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestExclude_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/pending-journeys/some-id/exclude", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestJourneyRecord_withOptionals(t *testing.T) {
	coverURL := "https://images.igdb.com/cover.jpg"
	logText := "Finally beat Malenia."
	rec := journeyRecord{
		Type:            "app.agon.journey",
		IGDBID:          119133,
		GameTitle:       "Elden Ring",
		CoverURL:        &coverURL,
		Genres:          []string{"RPG"},
		DurationSeconds: 11640,
		StartedAt:       "2026-05-23T10:00:00Z",
		EndedAt:         "2026-05-23T13:14:00Z",
		Log:             &logText,
	}

	b, err := json.Marshal(rec)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out["coverUrl"] != coverURL {
		t.Errorf("coverUrl = %v, want %s", out["coverUrl"], coverURL)
	}
	if out["log"] != logText {
		t.Errorf("log = %v, want %s", out["log"], logText)
	}
}
