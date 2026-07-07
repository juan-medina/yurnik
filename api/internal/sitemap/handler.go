// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package sitemap

import (
	"context"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type urlset struct {
	XMLName xml.Name `xml:"http://www.sitemaps.org/schemas/sitemap/0.9 urlset"`
	URLs    []urlURL `xml:"url"`
}

type urlURL struct {
	Loc        string `xml:"loc"`
	LastMod    string `xml:"lastmod,omitempty"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sitemap.xml", h.serveSitemap)
}

func (h *Handler) serveSitemap(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = "https://yurnik.social"
	}

	var urls []urlURL

	// Add static root
	urls = append(urls, urlURL{
		Loc:        baseURL + "/",
		ChangeFreq: "daily",
		Priority:   "1.0",
	})
	
	// Add Players
	urls = append(urls, h.getPlayerURLs(ctx, baseURL)...)

	// Add Games
	urls = append(urls, h.getGameURLs(ctx, baseURL)...)
	
	// Add Journeys
	urls = append(urls, h.getJourneyURLs(ctx, baseURL)...)

	sitemap := urlset{URLs: urls}
	w.Header().Set("Content-Type", "application/xml")
	w.Write([]byte(xml.Header))
	if err := xml.NewEncoder(w).Encode(sitemap); err != nil {
		log.Printf("sitemap: encode failed: %v", err)
	}
}

func (h *Handler) getPlayerURLs(ctx context.Context, baseURL string) []urlURL {
	var urls []urlURL
	// Limit to recent/top 1000 players to prevent huge sitemaps for now
	rows, err := h.pool.Query(ctx, `SELECT handle FROM users WHERE suspended_at IS NULL LIMIT 1000`)
	if err != nil {
		log.Printf("sitemap/players: %v", err)
		return urls
	}
	defer rows.Close()

	for rows.Next() {
		var handle string
		if err := rows.Scan(&handle); err == nil {
			urls = append(urls, urlURL{
				Loc:        fmt.Sprintf("%s/player/%s", baseURL, handle),
				ChangeFreq: "weekly",
				Priority:   "0.8",
			})
		}
	}
	return urls
}

func (h *Handler) getGameURLs(ctx context.Context, baseURL string) []urlURL {
	var urls []urlURL
	rows, err := h.pool.Query(ctx, `SELECT igdb_id FROM cached_games LIMIT 1000`)
	if err != nil {
		log.Printf("sitemap/games: %v", err)
		return urls
	}
	defer rows.Close()

	for rows.Next() {
		var igdbID int
		if err := rows.Scan(&igdbID); err == nil {
			urls = append(urls, urlURL{
				Loc:        fmt.Sprintf("%s/game/%d", baseURL, igdbID),
				ChangeFreq: "weekly",
				Priority:   "0.8",
			})
		}
	}
	return urls
}

func (h *Handler) getJourneyURLs(ctx context.Context, baseURL string) []urlURL {
	var urls []urlURL
	// Only fetch public confirmed journeys, limit 1000
	rows, err := h.pool.Query(ctx, `
		SELECT id, played_at FROM journeys 
		ORDER BY played_at DESC 
		LIMIT 1000
	`)
	if err != nil {
		log.Printf("sitemap/journeys: %v", err)
		return urls
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var playedAt time.Time
		if err := rows.Scan(&id, &playedAt); err == nil {
			urls = append(urls, urlURL{
				Loc:        fmt.Sprintf("%s/journey/%s", baseURL, id),
				LastMod:    playedAt.Format(time.RFC3339),
				ChangeFreq: "never",
				Priority:   "0.6",
			})
		}
	}
	return urls
}
