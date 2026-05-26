// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package profile

import (
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/agon/internal/auth"
	"github.com/juan-medina/agon/internal/db"
)

type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/me", h.getMe)
	mux.HandleFunc("PATCH /api/me", h.patchMe)
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	cookie, err := r.Cookie("agon_session")
	if err != nil {
		return "", false
	}
	did, err := auth.ParseAndRenewSession(w, cookie.Value, h.jwtPriv)
	if err != nil {
		return "", false
	}
	return did, true
}

type bskyProfile struct {
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	Avatar      string `json:"avatar"`
}

func fetchBskyProfile(did string) (bskyProfile, error) {
	resp, err := http.Get("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=" + did)
	if err != nil {
		return bskyProfile{}, fmt.Errorf("fetch profile: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return bskyProfile{}, fmt.Errorf("bsky profile %d: %s", resp.StatusCode, b)
	}
	var p bskyProfile
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return bskyProfile{}, fmt.Errorf("decode profile: %w", err)
	}
	return p, nil
}

type meResponse struct {
	DID         string  `json:"did"`
	Handle      string  `json:"handle"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
	Bio         *string `json:"bio"`
}

func (h *Handler) getMe(w http.ResponseWriter, r *http.Request) {
	did, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := db.GetUser(r.Context(), h.pool, did)
	if err != nil {
		log.Printf("profile/me: get user %s: %v", did, err)
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	bsky, err := fetchBskyProfile(did)
	if err != nil {
		log.Printf("profile/me: fetch bsky profile %s: %v", did, err)
		http.Error(w, "profile fetch failed", http.StatusBadGateway)
		return
	}

	resp := meResponse{
		DID:    user.DID,
		Handle: bsky.Handle,
		Bio:    user.Bio,
	}
	if bsky.DisplayName != "" {
		resp.DisplayName = &bsky.DisplayName
	}
	if bsky.Avatar != "" {
		resp.AvatarURL = &bsky.Avatar
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *Handler) patchMe(w http.ResponseWriter, r *http.Request) {
	did, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		Bio *string `json:"bio"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if body.Bio != nil {
		if err := db.UpdateBio(r.Context(), h.pool, did, *body.Bio); err != nil {
			log.Printf("profile/me: update bio %s: %v", did, err)
			http.Error(w, "update failed", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
