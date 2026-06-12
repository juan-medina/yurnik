// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package journeys

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/juan-medina/yurnik/internal/db"
)

func TestAdd_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/players/me/journeys",
		strings.NewReader(`{"igdb_id":1,"started_at":"2026-05-23T10:00:00Z","ended_at":"2026-05-23T13:00:00Z"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestDiscard_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/players/me/journeys/pending/some-id/discard", nil)
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

	r := httptest.NewRequest(http.MethodPost, "/api/players/me/journeys/pending/some-id/confirm",
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

	r := httptest.NewRequest(http.MethodDelete, "/api/players/me/journeys/some-id", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestListPending_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodGet, "/api/players/me/journeys/pending", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestListMine_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodGet, "/api/players/me/journeys", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestParsePlayedAt(t *testing.T) {
	t.Run("empty string defaults to today UTC at midnight", func(t *testing.T) {
		got, err := parsePlayedAt("")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := time.Now().UTC()
		if got.Year() != want.Year() || got.Month() != want.Month() || got.Day() != want.Day() {
			t.Errorf("got %v, want today (%v)", got, want)
		}
		if got.Hour() != 0 || got.Minute() != 0 || got.Second() != 0 {
			t.Errorf("expected midnight, got %v", got)
		}
		if got.Location() != time.UTC {
			t.Errorf("expected UTC location, got %v", got.Location())
		}
	})

	t.Run("parses a valid date string", func(t *testing.T) {
		got, err := parsePlayedAt("2026-06-12")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)
		if !got.Equal(want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("rejects an RFC3339 timestamp", func(t *testing.T) {
		if _, err := parsePlayedAt("2026-06-12T10:00:00Z"); err == nil {
			t.Error("expected an error for a non-date string, got nil")
		}
	})

	t.Run("rejects garbage", func(t *testing.T) {
		if _, err := parsePlayedAt("not-a-date"); err == nil {
			t.Error("expected an error for garbage input, got nil")
		}
	})

	t.Run("round-trips through db.DateFormat", func(t *testing.T) {
		got, err := parsePlayedAt("2026-01-01")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Format(db.DateFormat) != "2026-01-01" {
			t.Errorf("got %v, want 2026-01-01", got.Format(db.DateFormat))
		}
	})
}

func TestExclude_unauthenticated(t *testing.T) {
	h := &Handler{}
	mux := http.NewServeMux()
	h.Register(mux)

	r := httptest.NewRequest(http.MethodPost, "/api/players/me/journeys/pending/some-id/exclude", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}
