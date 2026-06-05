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
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
	"github.com/juan-medina/yurnik/internal/r2"
)

type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
	r2      *r2.Client
}

func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey, r2Client *r2.Client) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv, r2: r2Client}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/me", h.getMe)
	mux.HandleFunc("GET /api/me/profile", h.getMeProfile)
	mux.HandleFunc("PATCH /api/me", h.patchMe)
	mux.HandleFunc("POST /api/me/avatar", h.uploadAvatar)
	mux.HandleFunc("DELETE /api/me/avatar", h.deleteAvatar)
	mux.HandleFunc("GET /api/feed", h.getFeed)
	mux.HandleFunc("GET /api/players/{id}", h.getPlayer)
	mux.HandleFunc("GET /api/players/{id}/profile", h.getPlayerProfile)
	mux.HandleFunc("GET /api/players/{id}/followers", h.getFollowers)
	mux.HandleFunc("GET /api/players/{id}/following", h.getFollowing)
	mux.HandleFunc("POST /api/players/{id}/follow", h.followPlayer)
	mux.HandleFunc("DELETE /api/players/{id}/follow", h.unfollowPlayer)
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	cookie, err := r.Cookie("yurnik_session")
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
	ID              string  `json:"id"`
	Handle          string  `json:"handle"`
	Name            string  `json:"name"`
	AvatarURL       *string `json:"avatar_url"`
	Bio             *string `json:"bio"`
	Color           string  `json:"color"`
	IsAdmin         bool    `json:"is_admin"`
	HasCustomAvatar bool    `json:"has_custom_avatar"`
	HasCustomName   bool    `json:"has_custom_name"`
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
		ID:              user.ID,
		Handle:          user.Handle,
		Name:            user.Name,
		AvatarURL:       user.AvatarURL,
		Bio:             user.Bio,
		Color:           user.Color,
		IsAdmin:         user.IsAdmin,
		HasCustomAvatar: user.HasCustomAvatar,
		HasCustomName:   user.HasCustomName,
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

	// Best-effort echo — never block the response on notification failure.
	if err := db.UpsertFollowerEcho(r.Context(), h.pool, targetID, callerID); err != nil {
		log.Printf("profile/follow: upsert echo: %v", err)
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
		LikeCount       int        `json:"like_count"`
		IsLiked         bool       `json:"is_liked"`
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
			LikeCount: j.LikeCount,
			IsLiked:   j.IsLiked,
		})
	}

	result := map[string]any{"journeys": resp}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

type recentGameItem struct {
	IGDBID     int     `json:"igdb_id"`
	Name       string  `json:"name"`
	CoverURL   *string `json:"cover_url,omitempty"`
	LastPlayed string  `json:"last_played"`
}

type genreHoursItem struct {
	Genre   string `json:"genre"`
	Seconds int    `json:"seconds"`
}

type profileSummaryResponse struct {
	ID           string           `json:"id"`
	Handle       string           `json:"handle"`
	Name         string           `json:"name"`
	AvatarURL    *string          `json:"avatar_url,omitempty"`
	Bio          *string          `json:"bio,omitempty"`
	Color        string           `json:"color"`
	Followers    int              `json:"followers"`
	Following    int              `json:"following"`
	IsFollowing  bool             `json:"is_following"`
	JourneyCount int              `json:"journey_count"`
	TotalSeconds int              `json:"total_seconds"`
	RecentGames  []recentGameItem `json:"recent_games"`
	GenreHours   []genreHoursItem `json:"genre_hours"`
}

func buildProfileSummaryResponse(user db.User, followers, following int, isFollowing bool, summary db.ProfileSummary) profileSummaryResponse {
	resp := profileSummaryResponse{
		ID:           user.ID,
		Handle:       user.Handle,
		Name:         user.Name,
		AvatarURL:    user.AvatarURL,
		Bio:          user.Bio,
		Color:        user.Color,
		Followers:    followers,
		Following:    following,
		IsFollowing:  isFollowing,
		JourneyCount: summary.JourneyCount,
		TotalSeconds: summary.TotalSeconds,
		RecentGames:  make([]recentGameItem, 0, len(summary.RecentGames)),
		GenreHours:   make([]genreHoursItem, 0, len(summary.GenreHours)),
	}
	for _, g := range summary.RecentGames {
		resp.RecentGames = append(resp.RecentGames, recentGameItem{
			IGDBID:     g.IGDBID,
			Name:       g.Name,
			CoverURL:   g.CoverURL,
			LastPlayed: g.LastPlayed.UTC().Format(time.RFC3339),
		})
	}
	for _, gh := range summary.GenreHours {
		resp.GenreHours = append(resp.GenreHours, genreHoursItem{Genre: gh.Genre, Seconds: gh.Seconds})
	}
	return resp
}

func (h *Handler) getMeProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	h.writeProfileSummary(w, r, userID, false)
}

func (h *Handler) getPlayerProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	isFollowing := false
	if callerID, ok := h.authenticate(w, r); ok {
		isFollowing, _ = db.IsFollowing(r.Context(), h.pool, callerID, id)
	}
	h.writeProfileSummary(w, r, id, isFollowing)
}

func (h *Handler) writeProfileSummary(w http.ResponseWriter, r *http.Request, userID string, isFollowing bool) {
	user, err := db.GetUser(r.Context(), h.pool, userID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	followers, following, err := db.GetFollowCounts(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("profile/summary: follow counts %s: %v", userID, err)
	}
	summary, err := db.GetProfileSummary(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("profile/summary: %s: %v", userID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(buildProfileSummaryResponse(user, followers, following, isFollowing, summary))
}

func (h *Handler) patchMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		Bio         *string `json:"bio"`
		DisplayName *string `json:"display_name"`
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

	if body.DisplayName != nil {
		if err := db.UpdateDisplayName(r.Context(), h.pool, userID, *body.DisplayName); err != nil {
			log.Printf("profile/me: update display name %s: %v", userID, err)
			http.Error(w, "update failed", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// deleteAvatar clears the custom avatar, reverting to the Discord avatar.
func (h *Handler) deleteAvatar(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := db.UpdateAvatar(r.Context(), h.pool, userID, ""); err != nil {
		log.Printf("profile/avatar: delete %s: %v", userID, err)
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// uploadAvatar receives the avatar file, validates it, writes it to R2, and
// persists the public URL. Content-Length is checked before reading the body
// so oversized uploads are rejected immediately without consuming bandwidth.
func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > r2.MaxAvatarBytes {
		http.Error(w, "file too large: maximum 2 MB", http.StatusRequestEntityTooLarge)
		return
	}

	contentType := r.Header.Get("Content-Type")
	if !r2.AllowedContentTypes[contentType] {
		http.Error(w, "unsupported content type: use image/jpeg, image/png, or image/webp", http.StatusBadRequest)
		return
	}

	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Guard against clients that lie about Content-Length or omit it.
	body := http.MaxBytesReader(w, r.Body, r2.MaxAvatarBytes)

	publicURL, err := h.r2.UploadAvatar(r.Context(), userID, contentType, body, r.ContentLength)
	if err != nil {
		log.Printf("profile/avatar: upload %s: %v", userID, err)
		http.Error(w, "upload failed", http.StatusInternalServerError)
		return
	}

	if err := db.UpdateAvatar(r.Context(), h.pool, userID, publicURL); err != nil {
		log.Printf("profile/avatar: update db %s: %v", userID, err)
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
