// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ed25519"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newTestHandler(t *testing.T) *Handler {
	t.Helper()
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	return NewHandler(jwtPriv, nil, Config{FrontendURL: "http://localhost"})
}

func TestSession_missingCookie(t *testing.T) {
	h := newTestHandler(t)
	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	w := httptest.NewRecorder()

	h.session(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSession_unknownState(t *testing.T) {
	h := newTestHandler(t)
	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "nonexistent"})
	w := httptest.NewRecorder()

	h.session(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSession_userIDPending(t *testing.T) {
	h := newTestHandler(t)
	// State exists but userID not yet set (callback not completed).
	h.store.put("state1", "verifier", time.Minute)

	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w := httptest.NewRecorder()

	h.session(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

