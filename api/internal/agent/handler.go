// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package agent handles agent-specific API routes authenticated via Bearer JWT.
package agent

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/agon/internal/auth"
	"github.com/juan-medina/agon/internal/db"
)

// Handler handles agent API routes.
type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

// NewHandler returns a Handler.
func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

// Register mounts agent routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/agent/token", h.token)
	mux.HandleFunc("POST /api/v1/agent/heartbeat", h.heartbeat)
	mux.HandleFunc("POST /api/v1/agent/pending-journeys", h.createPending)
	mux.HandleFunc("POST /api/v1/agent/pending-journeys/{id}/end", h.endPending)
}

// token requires a valid web session cookie and returns a signed agent JWT.
// Called by the /auth/agent web page; the token is then handed to the agent
// via the agon:// URL scheme.
func (h *Handler) token(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("agon_session")
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	userID, err := auth.ParseAndRenewSession(w, cookie.Value, h.jwtPriv)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	tokenString, err := auth.CreateSessionJWT(userID, h.jwtPriv)
	if err != nil {
		log.Printf("agent/token: create JWT: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}

// heartbeat validates the agent's Bearer token. Returns 204 when valid, or
// 200 {"token":"<new>"} when the token is valid but older than 24 hours.
func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticateBearer(w, r)
	if !ok {
		return
	}

	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	pub := h.jwtPriv.Public().(ed25519.PublicKey)
	if age, err := auth.TokenAge(token, pub); err == nil && age > 24*time.Hour {
		if newToken, err := auth.CreateSessionJWT(userID, h.jwtPriv); err == nil {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"token": newToken})
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// createPending creates a new pending journey for the authenticated agent.
func (h *Handler) createPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticateBearer(w, r)
	if !ok {
		return
	}

	var body struct {
		ExeName     string `json:"exe_name"`
		WindowTitle string `json:"window_title"`
		StartedAt   string `json:"started_at"`
		EndedAt     string `json:"ended_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExeName == "" {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}

	startedAt := time.Now().UTC()
	if body.StartedAt != "" {
		if t, err := time.Parse(time.RFC3339, body.StartedAt); err == nil {
			startedAt = t.UTC()
		}
	}

	var endedAt *time.Time
	if body.EndedAt != "" {
		if t, err := time.Parse(time.RFC3339, body.EndedAt); err == nil {
			u := t.UTC()
			endedAt = &u
		}
	}

	excluded, err := db.IsExcluded(r.Context(), h.pool, userID, body.ExeName)
	if err != nil {
		log.Printf("agent/createPending: check exclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	if excluded {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	igdbID, err := db.GetGameHintIGDBID(r.Context(), h.pool, userID, body.ExeName)
	if err != nil {
		log.Printf("agent/createPending: get hint for %s: %v", body.ExeName, err)
		// non-fatal — proceed without a hint
		igdbID = nil
	}

	id, err := db.InsertPendingJourney(r.Context(), h.pool, userID, body.ExeName, body.WindowTitle, startedAt, igdbID, endedAt)
	if err != nil {
		log.Printf("agent/createPending: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
}

// endPending marks a pending journey as ended.
func (h *Handler) endPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticateBearer(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")

	var body struct {
		EndedAt string `json:"ended_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}

	endedAt := time.Now().UTC()
	if body.EndedAt != "" {
		if t, err := time.Parse(time.RFC3339, body.EndedAt); err == nil {
			endedAt = t.UTC()
		}
	}

	if err := db.EndPendingJourney(r.Context(), h.pool, id, userID, endedAt); err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// authenticateBearer parses Authorization: Bearer <token> and returns the user ID.
func (h *Handler) authenticateBearer(w http.ResponseWriter, r *http.Request) (string, bool) {
	hdr := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(hdr, "Bearer ")
	if !ok || token == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}
	pub := h.jwtPriv.Public().(ed25519.PublicKey)
	userID, err := auth.ParseSessionJWT(token, pub)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}
	return userID, true
}
