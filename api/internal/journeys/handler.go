// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package journeys handles journey confirmation, manual logging, and deletion.
package journeys

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
)

// Handler handles journey routes.
type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

// NewHandler returns a Handler.
func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

// commentResp is the JSON shape for a single comment.
type commentResp struct {
	ID     string `json:"id"`
	Player struct {
		ID        string  `json:"id"`
		Handle    string  `json:"handle"`
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatar_url,omitempty"`
		Color     string  `json:"color"`
	} `json:"player"`
	Text        string `json:"text"`
	CommentedAt string `json:"commented_at"`
}

func toCommentResp(c db.JourneyComment) commentResp {
	var r commentResp
	r.ID = c.ID
	r.Player.ID = c.UserID
	r.Player.Handle = c.PlayerHandle
	r.Player.Name = c.PlayerName
	r.Player.AvatarURL = c.PlayerAvatarURL
	r.Player.Color = c.PlayerColor
	r.Text = c.Body
	r.CommentedAt = c.CreatedAt.UTC().Format(time.RFC3339)
	return r
}

// Register mounts journey routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/journeys/{id}", h.get)
	mux.HandleFunc("GET /api/journeys/{id}/players", h.players)
	mux.HandleFunc("GET /api/journeys/{id}/comments", h.listComments)
	mux.HandleFunc("POST /api/journeys/{id}/comments", h.postComment)
	mux.HandleFunc("DELETE /api/journeys/{id}/comments/{commentId}", h.deleteComment)
	mux.HandleFunc("POST /api/players/me/journeys", h.add)
	mux.HandleFunc("PATCH /api/players/me/journeys/{id}", h.update)
	mux.HandleFunc("DELETE /api/players/me/journeys/{id}", h.delete)
	mux.HandleFunc("GET /api/players/me/journeys", h.listMine)
	mux.HandleFunc("GET /api/players/me/journeys/pending", h.listPending)
	mux.HandleFunc("GET /api/players/{id}/journeys", h.listByPlayer)
	mux.HandleFunc("POST /api/players/me/journeys/pending/{id}/confirm", h.confirm)
	mux.HandleFunc("POST /api/players/me/journeys/pending/{id}/discard", h.discard)
	mux.HandleFunc("POST /api/players/me/journeys/pending/{id}/exclude", h.exclude)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	j, err := db.GetJourneyByID(r.Context(), h.pool, id)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	type playerResp struct {
		ID        string  `json:"id"`
		Handle    string  `json:"handle"`
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatar_url,omitempty"`
		Color     string  `json:"color"`
	}
	type detailResp struct {
		ID              string     `json:"id"`
		IGDBID          int        `json:"igdb_id"`
		GameTitle       string     `json:"game"`
		CoverURL        *string    `json:"cover_url,omitempty"`
		Genres          []string   `json:"genres"`
		ReleaseYear     *int       `json:"release_year,omitempty"`
		DurationSeconds int        `json:"duration_seconds"`
		Log             *string    `json:"log,omitempty"`
		PlayedAt        string     `json:"played_at"`
		Player          playerResp `json:"player"`
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(detailResp{
		ID:              j.ID,
		IGDBID:          j.IGDBID,
		GameTitle:       j.GameName,
		CoverURL:        j.CoverURL,
		Genres:          j.Genres,
		ReleaseYear:     j.ReleaseYear,
		DurationSeconds: j.DurationSeconds,
		Log:             j.Log,
		PlayedAt:        j.PlayedAt.Format(db.DateFormat),
		Player: playerResp{
			ID:        j.UserID,
			Handle:    j.PlayerHandle,
			Name:      j.PlayerName,
			AvatarURL: j.PlayerAvatarURL,
			Color:     j.PlayerColor,
		},
	})
}

func (h *Handler) players(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	others, err := db.ListOthersOnJourney(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("journeys/players: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	followingIDs := map[string]bool{}
	if callerID, ok := h.tryAuthenticate(w, r); ok {
		followingIDs, _ = db.GetFollowingIDs(r.Context(), h.pool, callerID)
	}

	type playerResp struct {
		ID          string  `json:"id"`
		Handle      string  `json:"handle"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url,omitempty"`
		Color       string  `json:"color"`
		IsFollowing bool    `json:"is_following"`
	}
	type entryResp struct {
		JourneyID       string     `json:"journey_id"`
		Player          playerResp `json:"player"`
		DurationSeconds int        `json:"duration_seconds"`
		PlayedAt        string     `json:"played_at"`
	}

	resp := make([]entryResp, 0, len(others))
	for _, p := range others {
		resp = append(resp, entryResp{
			JourneyID: p.JourneyID,
			Player: playerResp{
				ID:          p.UserID,
				Handle:      p.Handle,
				Name:        p.Name,
				AvatarURL:   p.AvatarURL,
				Color:       p.Color,
				IsFollowing: followingIDs[p.UserID],
			},
			DurationSeconds: p.DurationSeconds,
			PlayedAt:        p.PlayedAt.Format(db.DateFormat),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"players": resp})
}

func (h *Handler) listComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	comments, err := db.ListComments(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("journeys/listComments: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	resp := make([]commentResp, 0, len(comments))
	for _, c := range comments {
		resp = append(resp, toCommentResp(c))
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"comments": resp})
}

func (h *Handler) postComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")

	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}

	comment, err := db.InsertComment(r.Context(), h.pool, id, userID, body.Text)
	if err != nil {
		log.Printf("journeys/postComment: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	// Best-effort echo/activity — never block the response on these failures.
	if meta, err := db.GetJourneyMeta(r.Context(), h.pool, id); err == nil {
		if err := db.UpsertCommentEcho(r.Context(), h.pool, meta.OwnerID, userID, id, meta.GameName); err != nil {
			log.Printf("journeys/postComment: upsert echo: %v", err)
		}
		if err := db.RecordActivity(r.Context(), h.pool, userID, meta.OwnerID, "new_comment", &id, &meta.GameName, &comment.ID); err != nil {
			log.Printf("journeys/postComment: record activity: %v", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(toCommentResp(comment))
}

func (h *Handler) deleteComment(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	commentId := r.PathValue("commentId")
	if err := db.DeleteComment(r.Context(), h.pool, commentId, userID); err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

func (h *Handler) tryAuthenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
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

// pendingResponse is the JSON shape for a pending journey.
type pendingResponse struct {
	ID          string   `json:"id"`
	Status      string   `json:"status"`
	IGDBID      *int     `json:"igdb_id,omitempty"`
	GameTitle   *string  `json:"game,omitempty"`
	CoverURL    *string  `json:"cover_url,omitempty"`
	Genres      []string `json:"genres,omitempty"`
	ExeName     *string  `json:"exe_name,omitempty"`
	WindowTitle *string  `json:"window_title,omitempty"`
	StartedAt   string   `json:"started_at"`
	EndedAt     *string  `json:"ended_at,omitempty"`
	Duration    string   `json:"duration,omitempty"`
}

// journeyResponse is the JSON shape for a confirmed journey.
type journeyResponse struct {
	ID              string   `json:"id"`
	IGDBID          int      `json:"igdb_id"`
	GameTitle       string   `json:"game"`
	CoverURL        *string  `json:"cover_url,omitempty"`
	Genres          []string `json:"genres"`
	ReleaseYear     *int     `json:"release_year,omitempty"`
	StartedAt       string   `json:"started_at"`
	EndedAt         string   `json:"ended_at"`
	DurationSeconds int      `json:"duration_seconds"`
	Log             *string  `json:"log,omitempty"`
	PlayedAt        string   `json:"played_at"`
}

func (h *Handler) listPending(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	pending, err := db.ListPendingJourneys(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("journeys/listPending: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	resp := make([]pendingResponse, 0, len(pending))
	for _, p := range pending {
		item := pendingResponse{
			ID:          p.ID,
			Status:      p.Status,
			IGDBID:      p.IGDBID,
			GameTitle:   p.GameName,
			CoverURL:    p.CoverURL,
			Genres:      p.Genres,
			ExeName:     p.ExeName,
			WindowTitle: p.WindowTitle,
			StartedAt:   p.StartedAt.UTC().Format(time.RFC3339),
		}
		if p.EndedAt != nil {
			s := p.EndedAt.UTC().Format(time.RFC3339)
			item.EndedAt = &s
			item.Duration = formatDuration(p.EndedAt.Sub(p.StartedAt))
		}
		resp = append(resp, item)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"journeys": resp})
}

func (h *Handler) confirm(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")

	pending, err := db.GetPendingJourney(r.Context(), h.pool, id, userID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	var body struct {
		IGDBID *int    `json:"igdb_id"`
		Log    *string `json:"log"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if body.IGDBID == nil {
		http.Error(w, `{"error":"invalid_request","message":"igdb_id is required"}`, http.StatusBadRequest)
		return
	}

	endedAt := time.Now().UTC()
	if pending.EndedAt != nil {
		endedAt = *pending.EndedAt
	}
	duration := int(endedAt.Sub(pending.StartedAt).Seconds())
	if duration < 60 {
		http.Error(w, `{"error":"invalid_request","message":"duration_seconds must be at least 60"}`, http.StatusBadRequest)
		return
	}

	startedAtUTC := pending.StartedAt.UTC()
	playedAt := time.Date(startedAtUTC.Year(), startedAtUTC.Month(), startedAtUTC.Day(), 0, 0, 0, 0, time.UTC)

	journeyID, err := db.InsertJourney(r.Context(), h.pool, db.Journey{
		UserID:          userID,
		IGDBID:          *body.IGDBID,
		StartedAt:       pending.StartedAt,
		EndedAt:         endedAt,
		DurationSeconds: duration,
		Log:             body.Log,
		PlayedAt:        playedAt,
	})
	if err != nil {
		log.Printf("journeys/confirm: insert journey: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	if pending.ExeName != nil {
		if err := db.UpsertGameHint(r.Context(), h.pool, userID, *pending.ExeName, *body.IGDBID); err != nil {
			log.Printf("journeys/confirm: upsert hint for %s: %v", *pending.ExeName, err)
		}
	}

	if err := db.DeletePendingJourney(r.Context(), h.pool, id, userID); err != nil {
		log.Printf("journeys/confirm: delete pending %s: %v", id, err)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"id": journeyID})
}

func (h *Handler) discard(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")
	if err := db.DeletePendingJourney(r.Context(), h.pool, id, userID); err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) exclude(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")

	pending, err := db.GetPendingJourney(r.Context(), h.pool, id, userID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	if pending.ExeName == nil {
		http.Error(w, `{"error":"invalid_request","message":"journey has no associated executable"}`, http.StatusBadRequest)
		return
	}

	if err := db.InsertExclusion(r.Context(), h.pool, userID, *pending.ExeName); err != nil {
		log.Printf("journeys/exclude: insert exclusion: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	if err := db.DeletePendingJourney(r.Context(), h.pool, id, userID); err != nil {
		log.Printf("journeys/exclude: delete pending %s: %v", id, err)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) add(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	var body struct {
		IGDBID          int     `json:"igdb_id"`
		DurationSeconds int     `json:"duration_seconds"`
		PlayedAt        string  `json:"played_at"`
		Log             *string `json:"log"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if body.IGDBID == 0 {
		http.Error(w, `{"error":"invalid_request","message":"igdb_id is required"}`, http.StatusBadRequest)
		return
	}
	if body.DurationSeconds < 60 {
		http.Error(w, `{"error":"invalid_request","message":"duration_seconds must be at least 60"}`, http.StatusBadRequest)
		return
	}

	playedAt, err := parsePlayedAt(body.PlayedAt)
	if err != nil {
		http.Error(w, `{"error":"invalid_request","message":"played_at must be a valid date"}`, http.StatusBadRequest)
		return
	}

	endedAt := time.Now().UTC()
	startedAt := endedAt.Add(-time.Duration(body.DurationSeconds) * time.Second)
	duration := body.DurationSeconds

	journeyID, err := db.InsertJourney(r.Context(), h.pool, db.Journey{
		UserID:          userID,
		IGDBID:          body.IGDBID,
		StartedAt:       startedAt,
		EndedAt:         endedAt,
		DurationSeconds: duration,
		Log:             body.Log,
		PlayedAt:        playedAt,
	})
	if err != nil {
		log.Printf("journeys/add: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"id": journeyID})
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")

	var body struct {
		IGDBID          int     `json:"igdb_id"`
		DurationSeconds int     `json:"duration_seconds"`
		PlayedAt        string  `json:"played_at"`
		Log             *string `json:"log"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid_request"}`, http.StatusBadRequest)
		return
	}
	if body.IGDBID == 0 {
		http.Error(w, `{"error":"invalid_request","message":"igdb_id is required"}`, http.StatusBadRequest)
		return
	}
	if body.DurationSeconds < 60 {
		http.Error(w, `{"error":"invalid_request","message":"duration_seconds must be at least 60"}`, http.StatusBadRequest)
		return
	}

	playedAt, err := parsePlayedAt(body.PlayedAt)
	if err != nil {
		http.Error(w, `{"error":"invalid_request","message":"played_at must be a valid date"}`, http.StatusBadRequest)
		return
	}

	endedAt := time.Now().UTC()

	if err := db.UpdateJourney(r.Context(), h.pool, id, userID, body.IGDBID, body.DurationSeconds, endedAt, playedAt, body.Log); err != nil {
		log.Printf("journeys/update: %v", err)
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	id := r.PathValue("id")
	if err := db.DeleteJourney(r.Context(), h.pool, id, userID); err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listMine(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")

	journeys, err := db.ListJourneysByUser(r.Context(), h.pool, userID, limit+1, cursor)
	if err != nil {
		log.Printf("journeys/listMine: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	var nextCursor string
	if len(journeys) > limit {
		nextCursor = db.EncodeJourneyCursor(journeys[limit].PlayedAt, journeys[limit].CreatedAt)
		journeys = journeys[:limit]
	}

	resp := make([]journeyResponse, 0, len(journeys))
	for _, j := range journeys {
		item := journeyResponse{
			ID:              j.ID,
			IGDBID:          j.IGDBID,
			GameTitle:       j.GameName,
			CoverURL:        j.CoverURL,
			Genres:          j.Genres,
			ReleaseYear:     j.ReleaseYear,
			StartedAt:       j.StartedAt.UTC().Format(time.RFC3339),
			EndedAt:         j.EndedAt.UTC().Format(time.RFC3339),
			DurationSeconds: j.DurationSeconds,
			Log:             j.Log,
			PlayedAt:        j.PlayedAt.Format(db.DateFormat),
		}
		resp = append(resp, item)
	}

	result := map[string]any{"journeys": resp}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) listByPlayer(w http.ResponseWriter, r *http.Request) {
	value := r.PathValue("id")
	player, err := db.GetUserByHandle(r.Context(), h.pool, value)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	playerID := player.ID

	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")

	journeys, err := db.ListJourneysByUser(r.Context(), h.pool, playerID, limit+1, cursor)
	if err != nil {
		log.Printf("journeys/listByPlayer: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	var nextCursor string
	if len(journeys) > limit {
		nextCursor = db.EncodeJourneyCursor(journeys[limit].PlayedAt, journeys[limit].CreatedAt)
		journeys = journeys[:limit]
	}

	resp := make([]journeyResponse, 0, len(journeys))
	for _, j := range journeys {
		item := journeyResponse{
			ID:              j.ID,
			IGDBID:          j.IGDBID,
			GameTitle:       j.GameName,
			CoverURL:        j.CoverURL,
			Genres:          j.Genres,
			ReleaseYear:     j.ReleaseYear,
			StartedAt:       j.StartedAt.UTC().Format(time.RFC3339),
			EndedAt:         j.EndedAt.UTC().Format(time.RFC3339),
			DurationSeconds: j.DurationSeconds,
			Log:             j.Log,
			PlayedAt:        j.PlayedAt.Format(db.DateFormat),
		}
		resp = append(resp, item)
	}

	result := map[string]any{"journeys": resp}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// parsePlayedAt parses a played_at date string (db.DateFormat). An empty
// string defaults to today (UTC).
func parsePlayedAt(s string) (time.Time, error) {
	if s == "" {
		now := time.Now().UTC()
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC), nil
	}
	return time.Parse(db.DateFormat, s)
}

func formatDuration(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	if h > 0 {
		return strconv.Itoa(h) + "h " + strconv.Itoa(m) + "m"
	}
	return strconv.Itoa(m) + "m"
}
