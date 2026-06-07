// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package games

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

type Handler struct {
	client  *Client
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

func NewHandler(client *Client, pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{client: client, pool: pool, jwtPriv: jwtPriv}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/games/search", h.search)
	mux.HandleFunc("GET /api/games/{igdbId}", h.detail)
	mux.HandleFunc("GET /api/games/{igdbId}/journeys", h.journeys)
	mux.HandleFunc("GET /api/activity", h.activity)
}

func (h *Handler) tryAuthenticate(r *http.Request) (string, bool) {
	cookie, err := r.Cookie("yurnik_session")
	if err != nil {
		return "", false
	}
	// ResponseWriter is nil — we only want to read the session, not renew it here.
	// Use a discard writer so ParseAndRenewSession can write the renewed cookie if needed.
	userID, err := auth.ParseAndRenewSession(noopResponseWriter{}, cookie.Value, h.jwtPriv)
	if err != nil {
		return "", false
	}
	return userID, true
}

// noopResponseWriter satisfies http.ResponseWriter for the tryAuthenticate path
// where we do not want to write anything to the actual response yet.
type noopResponseWriter struct{}

func (noopResponseWriter) Header() http.Header         { return http.Header{} }
func (noopResponseWriter) Write(b []byte) (int, error) { return len(b), nil }
func (noopResponseWriter) WriteHeader(int)              {}

func (h *Handler) detail(w http.ResponseWriter, r *http.Request) {
	igdbID, err := strconv.Atoi(r.PathValue("igdbId"))
	if err != nil {
		http.Error(w, "invalid igdb_id", http.StatusBadRequest)
		return
	}

	basic, err := db.GetGame(r.Context(), h.pool, igdbID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}

	detail, fresh, err := db.GetGameDetail(r.Context(), h.pool, igdbID)
	if err != nil {
		log.Printf("games/detail: read cache %d: %v", igdbID, err)
	}
	if !fresh {
		fetched, fetchErr := h.client.GetDetails(r.Context(), igdbID)
		if fetchErr != nil {
			log.Printf("games/detail: igdb fetch %d: %v", igdbID, fetchErr)
		} else {
			detail = db.CachedGameDetail{
				IGDBID:           fetched.IGDBID,
				Summary:          fetched.Summary,
				Screenshots:      fetched.Screenshots,
				Platforms:        fetched.Platforms,
				Developer:        fetched.Developer,
				Publisher:        fetched.Publisher,
				TrailerID:        fetched.TrailerID,
				StoreLinks:       fetched.StoreLinks,
				AggregatedRating: fetched.AggregatedRating,
				Rating:           fetched.Rating,
			}
			if upsertErr := db.UpsertGameDetail(r.Context(), h.pool, detail); upsertErr != nil {
				log.Printf("games/detail: upsert cache %d: %v", igdbID, upsertErr)
			}
		}
	}

	screenshots := detail.Screenshots
	if screenshots == nil {
		screenshots = []string{}
	}
	platforms := detail.Platforms
	if platforms == nil {
		platforms = []string{}
	}
	genres := basic.Genres
	if genres == nil {
		genres = []string{}
	}

	type resp struct {
		ID               string            `json:"id"`
		Name             string            `json:"name"`
		CoverURL         *string           `json:"cover_url,omitempty"`
		Genres           []string          `json:"genres"`
		ReleaseYear      *int              `json:"release_year,omitempty"`
		Category         *int              `json:"category,omitempty"`
		Summary          *string           `json:"summary,omitempty"`
		Screenshots      []string          `json:"screenshots"`
		Platforms        []string          `json:"platforms"`
		Developer        *string           `json:"developer,omitempty"`
		Publisher        *string           `json:"publisher,omitempty"`
		TrailerID        *string           `json:"trailer_id,omitempty"`
		StoreLinks       map[string]string `json:"store_links,omitempty"`
		AggregatedRating *float64          `json:"aggregated_rating,omitempty"`
		Rating           *float64          `json:"rating,omitempty"`
	}

	var coverURL *string
	if basic.CoverURL != "" {
		coverURL = &basic.CoverURL
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp{
		ID:               strconv.Itoa(basic.IGDBID),
		Name:             basic.Name,
		CoverURL:         coverURL,
		Genres:           genres,
		ReleaseYear:      basic.ReleaseYear,
		Category:         basic.Category,
		Summary:          detail.Summary,
		Screenshots:      screenshots,
		Platforms:        platforms,
		Developer:        detail.Developer,
		Publisher:        detail.Publisher,
		TrailerID:        detail.TrailerID,
		StoreLinks:       detail.StoreLinks,
		AggregatedRating: detail.AggregatedRating,
		Rating:           detail.Rating,
	})
}

func (h *Handler) journeys(w http.ResponseWriter, r *http.Request) {
	igdbID, err := strconv.Atoi(r.PathValue("igdbId"))
	if err != nil {
		http.Error(w, "invalid igdb_id", http.StatusBadRequest)
		return
	}

	callerID, authed := h.tryAuthenticate(r)
	players, err := db.ListJourneysByIGDBID(r.Context(), h.pool, igdbID)
	if err != nil {
		log.Printf("games/journeys: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	followingIDs := map[string]bool{}
	if authed {
		followingIDs, _ = db.GetFollowingIDs(r.Context(), h.pool, callerID)
	}

	type playerResp struct {
		ID          string  `json:"id"`
		Handle      string  `json:"handle"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url,omitempty"`
		Color       string  `json:"color"`
		IsFollowing bool    `json:"is_following"`
		IsSelf      bool    `json:"is_self"`
	}
	type entryResp struct {
		JourneyID       string     `json:"journey_id"`
		Player          playerResp `json:"player"`
		DurationSeconds int        `json:"duration_seconds"`
		PlayedAt        string     `json:"played_at"`
	}

	resp := make([]entryResp, 0, len(players))
	for _, p := range players {
		resp = append(resp, entryResp{
			JourneyID: p.JourneyID,
			Player: playerResp{
				ID:          p.UserID,
				Handle:      p.Handle,
				Name:        p.Name,
				AvatarURL:   p.AvatarURL,
				Color:       p.Color,
				IsFollowing: followingIDs[p.UserID],
				IsSelf:      authed && p.UserID == callerID,
			},
			DurationSeconds: p.DurationSeconds,
			PlayedAt:        p.PlayedAt.UTC().Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"players": resp})
}

type gameResponse struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	CoverURL    *string  `json:"cover_url,omitempty"`
	Genres      []string `json:"genres"`
	ReleaseYear *int     `json:"release_year,omitempty"`
	Category    *int     `json:"category,omitempty"`
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		http.Error(w, "missing q", http.StatusBadRequest)
		return
	}

	offset := 0
	if s := r.URL.Query().Get("offset"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n >= 0 {
			offset = n
		}
	}

	games, err := h.client.Search(r.Context(), q, offset)
	if err != nil {
		log.Printf("games/search: %v", err)
		http.Error(w, "search failed", http.StatusBadGateway)
		return
	}

	for _, g := range games {
		if err := db.UpsertGame(r.Context(), h.pool, db.CachedGame{
			IGDBID:      g.IGDBID,
			Name:        g.Name,
			CoverURL:    g.CoverURL,
			Genres:      g.Genres,
			ReleaseYear: g.ReleaseYear,
			Category:    g.Category,
		}); err != nil {
			log.Printf("games/search: cache %d: %v", g.IGDBID, err)
		}
	}

	resp := make([]gameResponse, len(games))
	for i, g := range games {
		resp[i] = gameResponse{
			ID:          strconv.Itoa(g.IGDBID),
			Name:        g.Name,
			Genres:      g.Genres,
			ReleaseYear: g.ReleaseYear,
			Category:    g.Category,
		}
		if g.CoverURL != "" {
			u := g.CoverURL
			resp[i].CoverURL = &u
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *Handler) activity(w http.ResponseWriter, r *http.Request) {
	entries, err := db.GetGameActivity(r.Context(), h.pool)
	if err != nil {
		log.Printf("games/activity: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	type playerResp struct {
		ID        string  `json:"id"`
		Handle    string  `json:"handle"`
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatar_url,omitempty"`
		Color     string  `json:"color"`
	}
	type entryResp struct {
		SessionID       string     `json:"session_id"`
		Player          playerResp `json:"player"`
		DurationSeconds int        `json:"duration_seconds"`
		PlayedAt        string     `json:"played_at"`
		Log             *string    `json:"log,omitempty"`
	}
	type gameResp struct {
		ID          string      `json:"id"`
		Game        string      `json:"game"`
		CoverURL    *string     `json:"cover_url,omitempty"`
		Genres      []string    `json:"genres"`
		ReleaseYear *int        `json:"release_year,omitempty"`
		Entries     []entryResp `json:"entries"`
	}

	// Group flat rows into per-game buckets preserving order.
	var games []gameResp
	index := map[int]int{} // igdb_id → slice index
	for _, e := range entries {
		if _, seen := index[e.IGDBID]; !seen {
			index[e.IGDBID] = len(games)
			genres := e.Genres
			if genres == nil {
				genres = []string{}
			}
			games = append(games, gameResp{
				ID:          strconv.Itoa(e.IGDBID),
				Game:        e.GameName,
				CoverURL:    e.CoverURL,
				Genres:      genres,
				ReleaseYear: e.ReleaseYear,
				Entries:     []entryResp{},
			})
		}
		i := index[e.IGDBID]
		games[i].Entries = append(games[i].Entries, entryResp{
			SessionID: e.SessionID,
			Player: playerResp{
				ID:        e.UserID,
				Handle:    e.PlayerHandle,
				Name:      e.PlayerName,
				AvatarURL: e.PlayerAvatarURL,
				Color:     e.PlayerColor,
			},
			DurationSeconds: e.DurationSeconds,
			PlayedAt:        e.PlayedAt.UTC().Format(time.RFC3339),
			Log:             e.Log,
		})
	}

	if games == nil {
		games = []gameResp{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"games": games})
}
