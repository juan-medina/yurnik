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
	"testing"

	"github.com/juan-medina/yurnik/internal/db"
)

func TestAuthenticate_CookieValid(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, _ := ed25519.GenerateKey(rand.Reader)
	userID := createTestUser(t, pool)

	cookieVal, _ := CreateSessionJWT(userID, jwtPriv)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "yurnik_session", Value: cookieVal})
	w := httptest.NewRecorder()

	gotUserID, ok := Authenticate(w, r, jwtPriv, pool)
	if !ok {
		t.Fatalf("Authenticate failed, expected true")
	}
	if gotUserID != userID {
		t.Errorf("Authenticate returned %q, want %q", gotUserID, userID)
	}
}

func TestAuthenticate_BearerValid(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, _ := ed25519.GenerateKey(rand.Reader)
	userID := createTestUser(t, pool)

	tokenVal, _ := CreateSessionJWT(userID, jwtPriv)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tokenVal)
	w := httptest.NewRecorder()

	gotUserID, ok := Authenticate(w, r, jwtPriv, pool)
	if !ok {
		t.Fatalf("Authenticate failed, expected true")
	}
	if gotUserID != userID {
		t.Errorf("Authenticate returned %q, want %q", gotUserID, userID)
	}
}

func TestAuthenticate_MissingCredentials(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, _ := ed25519.GenerateKey(rand.Reader)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	_, ok := Authenticate(w, r, jwtPriv, pool)
	if ok {
		t.Errorf("Authenticate succeeded, expected false")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("w.Code = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestAuthenticate_DeletedUser(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, _ := ed25519.GenerateKey(rand.Reader)
	userID := createTestUser(t, pool)

	tokenVal, _ := CreateSessionJWT(userID, jwtPriv)

	// delete user explicitly
	if err := db.DeleteUser(context.Background(), pool, userID); err != nil {
		t.Fatalf("delete user: %v", err)
	}

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+tokenVal)
	w := httptest.NewRecorder()

	_, ok := Authenticate(w, r, jwtPriv, pool)
	if ok {
		t.Fatalf("Authenticate succeeded for deleted user")
	}
	if w.Code != http.StatusUnauthorized {
		t.Errorf("w.Code = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestTryAuthenticate_NoWriteError(t *testing.T) {
	pool := connectTestDB(t)
	_, jwtPriv, _ := ed25519.GenerateKey(rand.Reader)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	_, ok := TryAuthenticate(w, r, jwtPriv, pool)
	if ok {
		t.Errorf("TryAuthenticate succeeded, expected false")
	}
	// TryAuthenticate should NOT write an HTTP response
	if w.Code != http.StatusOK { // httptest.NewRecorder() defaults to 200
		t.Errorf("TryAuthenticate wrote response status %d, expected none (200 default)", w.Code)
	}
}
