// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ed25519"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const sessionDuration = 7 * 24 * time.Hour

// reissue a fresh token once a day so active users never hit the 7-day wall
const sessionRenewAfter = 24 * time.Hour

type sessionClaims struct {
	jwt.RegisteredClaims
}

// CreateSessionJWT issues a signed EdDSA JWT containing the user's internal
// UUID as subject.
func CreateSessionJWT(userID string, priv ed25519.PrivateKey) (string, error) {
	now := time.Now()
	claims := sessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(sessionDuration)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims)
	return t.SignedString(priv)
}

// TokenAge returns how long ago the given JWT was issued, or an error if the
// token is invalid. Used by the agent heartbeat to decide whether to renew.
func TokenAge(tokenString string, pub ed25519.PublicKey) (time.Duration, error) {
	t, err := jwt.ParseWithClaims(tokenString, &sessionClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return pub, nil
	})
	if err != nil {
		return 0, err
	}
	claims, ok := t.Claims.(*sessionClaims)
	if !ok || !t.Valid {
		return 0, fmt.Errorf("invalid token")
	}
	return time.Since(claims.IssuedAt.Time), nil
}

// ParseSessionJWT verifies a session JWT and returns the user's internal UUID.
func ParseSessionJWT(tokenString string, pub ed25519.PublicKey) (string, error) {
	t, err := jwt.ParseWithClaims(tokenString, &sessionClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return pub, nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := t.Claims.(*sessionClaims)
	if !ok || !t.Valid {
		return "", fmt.Errorf("invalid token")
	}
	return claims.Subject, nil
}

// ParseAndRenewSession verifies the JWT and returns the user's internal UUID.
// If the token is older than sessionRenewAfter, a fresh token is issued and
// set as a new cookie — the caller sees nothing.
func ParseAndRenewSession(w http.ResponseWriter, tokenString string, priv ed25519.PrivateKey) (string, error) {
	pub := priv.Public().(ed25519.PublicKey)
	t, err := jwt.ParseWithClaims(tokenString, &sessionClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return pub, nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := t.Claims.(*sessionClaims)
	if !ok || !t.Valid {
		return "", fmt.Errorf("invalid token")
	}

	if time.Since(claims.IssuedAt.Time) > sessionRenewAfter {
		if newToken, err := CreateSessionJWT(claims.Subject, priv); err == nil {
			http.SetCookie(w, &http.Cookie{
				Name:     "yurnik_session",
				Value:    newToken,
				Path:     "/",
				HttpOnly: true,
				SameSite: http.SameSiteStrictMode,
				MaxAge:   int(sessionDuration.Seconds()),
			})
		}
	}

	return claims.Subject, nil
}
