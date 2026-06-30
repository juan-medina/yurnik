// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ed25519"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// Authenticate extracts the session cookie or Bearer token from the request,
// validates it, and returns the user's internal UUID.
// It also checks that the user has not been deleted.
// If missing or invalid, it writes a 401 response and returns ok=false.
// If a valid cookie is nearing expiration, it issues a fresh cookie.
func Authenticate(w http.ResponseWriter, r *http.Request, priv ed25519.PrivateKey, pool *pgxpool.Pool) (string, bool) {
	var userID string
	var err error

	if cookie, e := r.Cookie("yurnik_session"); e == nil {
		userID, err = ParseAndRenewSession(w, cookie.Value, priv)
	} else {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return "", false
		}
		pub := priv.Public().(ed25519.PublicKey)
		userID, err = ParseSessionJWT(token, pub)
	}

	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}

	if _, err := db.GetUser(r.Context(), pool, userID); err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}

	return userID, true
}

// TryAuthenticate acts like Authenticate but does not write an HTTP error
// response if authentication fails. It simply returns ok=false.
func TryAuthenticate(w http.ResponseWriter, r *http.Request, priv ed25519.PrivateKey, pool *pgxpool.Pool) (string, bool) {
	var userID string
	var err error

	if cookie, e := r.Cookie("yurnik_session"); e == nil {
		userID, err = ParseAndRenewSession(w, cookie.Value, priv)
	} else {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			return "", false
		}
		pub := priv.Public().(ed25519.PublicKey)
		userID, err = ParseSessionJWT(token, pub)
	}

	if err != nil {
		return "", false
	}

	if _, err := db.GetUser(r.Context(), pool, userID); err != nil {
		return "", false
	}

	return userID, true
}
