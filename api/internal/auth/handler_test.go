// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newTestHandler(t *testing.T) *Handler {
	t.Helper()
	dpopPriv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate dpop key: %v", err)
	}
	_, jwtPriv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate jwt key: %v", err)
	}
	return NewHandler(dpopPriv, jwtPriv, nil, Config{FrontendURL: "http://localhost"})
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

func TestSession_didPending(t *testing.T) {
	h := newTestHandler(t)
	// State exists but DID not yet set (callback not completed).
	h.store.put("state1", "verifier", time.Minute)

	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w := httptest.NewRecorder()

	h.session(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSession_success(t *testing.T) {
	h := newTestHandler(t)
	h.store.put("state1", "verifier", time.Minute)
	h.store.setDID("state1", "did:plc:abc123")

	r := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w := httptest.NewRecorder()

	h.session(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	// agon_session cookie must be set and non-empty.
	var sessionCookie *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == "agon_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || strings.TrimSpace(sessionCookie.Value) == "" {
		t.Error("agon_session cookie missing or empty")
	}

	// State must be consumed — a second call with the same cookie fails.
	r2 := httptest.NewRequest(http.MethodPost, "/auth/session", nil)
	r2.AddCookie(&http.Cookie{Name: "auth_state", Value: "state1"})
	w2 := httptest.NewRecorder()
	h.session(w2, r2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("second session call: status = %d, want %d", w2.Code, http.StatusBadRequest)
	}
}
