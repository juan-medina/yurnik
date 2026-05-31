// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package admin

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/agon/internal/auth"
	"github.com/juan-medina/agon/internal/db"
)

const sessionDuration = 7 * 24 * time.Hour

type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/admin/users", h.listUsers)
	mux.HandleFunc("POST /api/admin/impersonate/{userID}", h.impersonate)
}

// requireAdmin authenticates the request and returns the caller if they are an
// admin. Writes 401/403 and returns false otherwise.
func (h *Handler) requireAdmin(w http.ResponseWriter, r *http.Request) (db.User, bool) {
	cookie, err := r.Cookie("agon_session")
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return db.User{}, false
	}
	userID, err := auth.ParseAndRenewSession(w, cookie.Value, h.jwtPriv)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return db.User{}, false
	}
	u, err := db.GetUser(r.Context(), h.pool, userID)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return db.User{}, false
	}
	if !u.IsAdmin {
		http.Error(w, "forbidden", http.StatusForbidden)
		return db.User{}, false
	}
	return u, true
}

type userSummary struct {
	ID        string  `json:"id"`
	Handle    string  `json:"handle"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url"`
	Color     string  `json:"color"`
	IsAdmin   bool    `json:"is_admin"`
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireAdmin(w, r); !ok {
		return
	}
	users, err := db.ListUsers(r.Context(), h.pool)
	if err != nil {
		log.Printf("admin/users: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	resp := make([]userSummary, len(users))
	for i, u := range users {
		resp[i] = userSummary{
			ID:        u.ID,
			Handle:    u.Handle,
			Name:      u.Name,
			AvatarURL: u.AvatarURL,
			Color:     u.Color,
			IsAdmin:   u.IsAdmin,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *Handler) impersonate(w http.ResponseWriter, r *http.Request) {
	caller, ok := h.requireAdmin(w, r)
	if !ok {
		return
	}
	targetID := r.PathValue("userID")
	if targetID == caller.ID {
		http.Error(w, "already this user", http.StatusBadRequest)
		return
	}
	if _, err := db.GetUser(r.Context(), h.pool, targetID); err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	token, err := auth.CreateSessionJWT(targetID, h.jwtPriv)
	if err != nil {
		log.Printf("admin/impersonate: jwt for %s: %v", targetID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "agon_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})
	w.WriteHeader(http.StatusNoContent)
}
