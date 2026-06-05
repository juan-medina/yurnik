// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package games

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

type Handler struct {
	client *Client
	pool   *pgxpool.Pool
}

func NewHandler(client *Client, pool *pgxpool.Pool) *Handler {
	return &Handler{client: client, pool: pool}
}


func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/games/search", h.search)
	mux.HandleFunc("GET /api/activity", h.activity)
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
