// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package profile

import (
	"crypto/ed25519"
	"encoding/json"
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
	userID, err := auth.ParseAndRenewSession(w, cookie.Value, h.jwtPriv)
	if err != nil {
		return "", false
	}
	return userID, true
}

type meResponse struct {
	ID        string  `json:"id"`
	Handle    string  `json:"handle"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url"`
	Bio       *string `json:"bio"`
	Color     string  `json:"color"`
	IsAdmin   bool    `json:"is_admin"`
}

func (h *Handler) getMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := db.GetUser(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("profile/me: get user %s: %v", userID, err)
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(meResponse{
		ID:        user.ID,
		Handle:    user.Handle,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		Color:     user.Color,
		IsAdmin:   user.IsAdmin,
	})
}

func (h *Handler) patchMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
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
		if err := db.UpdateBio(r.Context(), h.pool, userID, *body.Bio); err != nil {
			log.Printf("profile/me: update bio %s: %v", userID, err)
			http.Error(w, "update failed", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
