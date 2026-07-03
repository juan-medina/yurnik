// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package settings manages per-user excluded executables and exe→game hints.
package settings

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

// Handler handles settings routes.
type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

// NewHandler returns a Handler.
func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

// Register mounts settings routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/settings/exclusions", h.listExclusions)
	mux.HandleFunc("POST /api/settings/exclusions", h.addExclusion)
	mux.HandleFunc("DELETE /api/settings/exclusions/{exeName}", h.deleteExclusion)
	mux.HandleFunc("GET /api/settings/inclusions", h.listInclusions)
	mux.HandleFunc("POST /api/settings/inclusions", h.addInclusion)
	mux.HandleFunc("DELETE /api/settings/inclusions/{exeName}", h.deleteInclusion)
	mux.HandleFunc("GET /api/settings/hints", h.listHints)
	mux.HandleFunc("PUT /api/settings/hints/{exeName}", h.upsertHint)
	mux.HandleFunc("DELETE /api/settings/hints/{exeName}", h.deleteHint)
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	cookie, err := r.Cookie("yurnik_session")
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}
	userID, err := auth.ParseAndRenewSession(w, cookie.Value, h.jwtPriv)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return "", false
	}
	return userID, true
}

func (h *Handler) listExclusions(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	exs, err := db.ListExclusions(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("settings/listExclusions: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	type row struct {
		ExeName string `json:"exe_name"`
	}
	resp := make([]row, len(exs))
	for i, e := range exs {
		resp[i] = row{ExeName: e.ExeName}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"exclusions": resp})
}

func (h *Handler) addExclusion(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	var body struct {
		ExeName string `json:"exe_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExeName == "" {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if err := db.InsertExclusion(r.Context(), h.pool, userID, body.ExeName); err != nil {
		log.Printf("settings/addExclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteExclusion(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	exeName := r.PathValue("exeName")
	if err := db.DeleteExclusion(r.Context(), h.pool, userID, exeName); err != nil {
		log.Printf("settings/deleteExclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listInclusions(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	incs, err := db.ListInclusions(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("settings/listInclusions: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	type row struct {
		ExeName string `json:"exe_name"`
	}
	resp := make([]row, len(incs))
	for i, inc := range incs {
		resp[i] = row{ExeName: inc.ExeName}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"inclusions": resp})
}

func (h *Handler) addInclusion(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	var body struct {
		ExeName string `json:"exe_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ExeName == "" {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if err := db.InsertInclusion(r.Context(), h.pool, userID, body.ExeName); err != nil {
		log.Printf("settings/addInclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteInclusion(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	exeName := r.PathValue("exeName")
	if err := db.DeleteInclusion(r.Context(), h.pool, userID, exeName); err != nil {
		log.Printf("settings/deleteInclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listHints(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	hints, err := db.ListGameHints(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("settings/listHints: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	type row struct {
		ExeName string `json:"exe_name"`
		IGDBID  int    `json:"igdb_id"`
		Title   string `json:"title"`
	}
	resp := make([]row, len(hints))
	for i, hint := range hints {
		resp[i] = row{ExeName: hint.ExeName, IGDBID: hint.IGDBID, Title: hint.Title}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"hints": resp})
}

func (h *Handler) upsertHint(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	exeName := r.PathValue("exeName")
	var body struct {
		IGDBID int `json:"igdb_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IGDBID == 0 {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if err := db.UpsertGameHint(r.Context(), h.pool, userID, exeName, body.IGDBID); err != nil {
		log.Printf("settings/upsertHint: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteHint(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	exeName := r.PathValue("exeName")
	if err := db.DeleteGameHint(r.Context(), h.pool, userID, exeName); err != nil {
		log.Printf("settings/deleteHint: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
