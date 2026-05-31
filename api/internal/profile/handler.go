// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package profile

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

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
	mux.HandleFunc("GET /api/feed", h.getFeed)
	mux.HandleFunc("GET /api/players/{id}", h.getPlayer)
	mux.HandleFunc("GET /api/players/{id}/followers", h.getFollowers)
	mux.HandleFunc("GET /api/players/{id}/following", h.getFollowing)
	mux.HandleFunc("POST /api/players/{id}/follow", h.followPlayer)
	mux.HandleFunc("DELETE /api/players/{id}/follow", h.unfollowPlayer)
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

func (h *Handler) getPlayer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := db.GetUser(r.Context(), h.pool, id)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	followers, following, err := db.GetFollowCounts(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("profile/player: follow counts %s: %v", id, err)
	}

	isFollowing := false
	if callerID, ok := h.authenticate(w, r); ok {
		isFollowing, _ = db.IsFollowing(r.Context(), h.pool, callerID, id)
	}

	type playerResponse struct {
		ID          string  `json:"id"`
		Handle      string  `json:"handle"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url,omitempty"`
		Bio         *string `json:"bio,omitempty"`
		Color       string  `json:"color"`
		Followers   int     `json:"followers"`
		Following   int     `json:"following"`
		IsFollowing bool    `json:"is_following"`
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(playerResponse{
		ID:          user.ID,
		Handle:      user.Handle,
		Name:        user.Name,
		AvatarURL:   user.AvatarURL,
		Bio:         user.Bio,
		Color:       user.Color,
		Followers:   followers,
		Following:   following,
		IsFollowing: isFollowing,
	})
}

func (h *Handler) followPlayer(w http.ResponseWriter, r *http.Request) {
	callerID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	targetID := r.PathValue("id")
	if callerID == targetID {
		http.Error(w, "cannot follow yourself", http.StatusBadRequest)
		return
	}
	if err := db.FollowUser(r.Context(), h.pool, callerID, targetID); err != nil {
		log.Printf("profile/follow: %s -> %s: %v", callerID, targetID, err)
		http.Error(w, "follow failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unfollowPlayer(w http.ResponseWriter, r *http.Request) {
	callerID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	targetID := r.PathValue("id")
	if err := db.UnfollowUser(r.Context(), h.pool, callerID, targetID); err != nil {
		log.Printf("profile/unfollow: %s -> %s: %v", callerID, targetID, err)
		http.Error(w, "unfollow failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getFollowers(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	users, err := db.GetFollowers(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("profile/followers: %s: %v", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"players": usersToPlayerItems(users)})
}

func (h *Handler) getFollowing(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	users, err := db.GetFollowing(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("profile/following: %s: %v", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"players": usersToPlayerItems(users)})
}

type playerItem struct {
	ID        string  `json:"id"`
	Handle    string  `json:"handle"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url,omitempty"`
	Color     string  `json:"color"`
}

func usersToPlayerItems(users []db.User) []playerItem {
	items := make([]playerItem, len(users))
	for i, u := range users {
		items[i] = playerItem{ID: u.ID, Handle: u.Handle, Name: u.Name, AvatarURL: u.AvatarURL, Color: u.Color}
	}
	return items
}

func (h *Handler) getFeed(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	limit := 20
	if s := r.URL.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")

	journeys, err := db.GetFollowingFeed(r.Context(), h.pool, userID, limit+1, cursor)
	if err != nil {
		log.Printf("profile/feed: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var nextCursor string
	if len(journeys) > limit {
		nextCursor = journeys[limit].PlayedAt.UTC().Format(time.RFC3339)
		journeys = journeys[:limit]
	}

	type playerResp struct {
		ID        string  `json:"id"`
		Handle    string  `json:"handle"`
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatar_url,omitempty"`
		Color     string  `json:"color"`
	}
	type feedEntry struct {
		ID              string     `json:"id"`
		IGDBID          int        `json:"igdb_id"`
		GameTitle       string     `json:"game"`
		CoverURL        *string    `json:"cover_url,omitempty"`
		Genres          []string   `json:"genres"`
		DurationSeconds int        `json:"duration_seconds"`
		Log             *string    `json:"log,omitempty"`
		PlayedAt        string     `json:"played_at"`
		Player          playerResp `json:"player"`
	}

	resp := make([]feedEntry, 0, len(journeys))
	for _, j := range journeys {
		resp = append(resp, feedEntry{
			ID:              j.ID,
			IGDBID:          j.IGDBID,
			GameTitle:       j.GameName,
			CoverURL:        j.CoverURL,
			Genres:          j.Genres,
			DurationSeconds: j.DurationSeconds,
			Log:             j.Log,
			PlayedAt:        j.PlayedAt.UTC().Format(time.RFC3339),
			Player: playerResp{
				ID:        j.UserID,
				Handle:    j.PlayerHandle,
				Name:      j.PlayerName,
				AvatarURL: j.PlayerAvatarURL,
				Color:     j.PlayerColor,
			},
		})
	}

	result := map[string]any{"journeys": resp}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
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
