// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package backlog handles routes for a player's Backlog — a public list of
// games they intend to play in the future.
package backlog

import (
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

// Handler handles Backlog routes.
type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

// NewHandler returns a Handler.
func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

// Register mounts Backlog routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/players/{handle}/backlog", h.list)
	mux.HandleFunc("POST /api/me/backlog", h.add)
	mux.HandleFunc("DELETE /api/me/backlog/{igdbId}", h.remove)
	mux.HandleFunc("PATCH /api/me/backlog/order", h.reorder)
}

type entryResp struct {
	IGDBID      int      `json:"igdb_id"`
	Name        string   `json:"name"`
	CoverURL    *string  `json:"cover_url,omitempty"`
	Genres      []string `json:"genres"`
	ReleaseYear *int     `json:"release_year,omitempty"`
	ReleaseDate *string  `json:"release_date,omitempty"`
	AddedAt     string   `json:"added_at"`
}

func toEntryResp(e db.BacklogEntry) entryResp {
	genres := e.Genres
	if genres == nil {
		genres = []string{}
	}
	var releaseDate *string
	if e.ReleaseDate != nil {
		s := e.ReleaseDate.UTC().Format(time.RFC3339)
		releaseDate = &s
	}
	return entryResp{
		IGDBID:      e.IGDBID,
		Name:        e.Name,
		CoverURL:    e.CoverURL,
		Genres:      genres,
		ReleaseYear: e.ReleaseYear,
		ReleaseDate: releaseDate,
		AddedAt:     e.AddedAt.UTC().Format(time.RFC3339),
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	user, err := db.GetUserByHandle(r.Context(), h.pool, r.PathValue("handle"))
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	entries, err := db.ListBacklogEntries(r.Context(), h.pool, user.ID)
	if err != nil {
		log.Printf("backlog/list: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	resp := make([]entryResp, 0, len(entries))
	for _, e := range entries {
		resp = append(resp, toEntryResp(e))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"entries": resp})
}

func (h *Handler) add(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}

	var body struct {
		IGDBID int `json:"igdb_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_body"}`, http.StatusBadRequest)
		return
	}

	game, err := db.GetGame(r.Context(), h.pool, body.IGDBID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	added, err := db.AddBacklogEntry(r.Context(), h.pool, userID, body.IGDBID)
	if err != nil {
		log.Printf("backlog/add: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	if added {
		if err := db.RecordBacklogAdd(r.Context(), h.pool, userID, body.IGDBID, game.Name); err != nil {
			log.Printf("backlog/add: record activity: %v", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}

	igdbID, err := strconv.Atoi(r.PathValue("igdbId"))
	if err != nil {
		http.Error(w, "invalid igdb_id", http.StatusBadRequest)
		return
	}

	if err := db.RemoveBacklogEntry(r.Context(), h.pool, userID, igdbID); err != nil {
		log.Printf("backlog/remove: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) reorder(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}

	var body struct {
		IGDBIDs []int `json:"igdb_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_body"}`, http.StatusBadRequest)
		return
	}

	if err := db.ReorderBacklogEntries(r.Context(), h.pool, userID, body.IGDBIDs); err != nil {
		if errors.Is(err, db.ErrBacklogOrderMismatch) {
			http.Error(w, `{"error":"order_mismatch"}`, http.StatusBadRequest)
			return
		}
		log.Printf("backlog/reorder: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
