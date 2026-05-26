// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package games

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/agon/internal/db"
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
}

type gameResponse struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	CoverURL *string  `json:"cover_url,omitempty"`
	Genres   []string `json:"genres"`
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		http.Error(w, "missing q", http.StatusBadRequest)
		return
	}

	games, err := h.client.Search(r.Context(), q)
	if err != nil {
		log.Printf("games/search: %v", err)
		http.Error(w, "search failed", http.StatusBadGateway)
		return
	}

	for _, g := range games {
		if err := db.UpsertGame(r.Context(), h.pool, db.CachedGame{
			IGDBID:   g.IGDBID,
			Name:     g.Name,
			CoverURL: g.CoverURL,
			Genres:   g.Genres,
		}); err != nil {
			log.Printf("games/search: cache %d: %v", g.IGDBID, err)
		}
	}

	resp := make([]gameResponse, len(games))
	for i, g := range games {
		resp[i] = gameResponse{
			ID:     strconv.Itoa(g.IGDBID),
			Name:   g.Name,
			Genres: g.Genres,
		}
		if g.CoverURL != "" {
			u := g.CoverURL
			resp[i].CoverURL = &u
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
