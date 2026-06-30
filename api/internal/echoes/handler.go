// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package echoes handles in-app notification routes.
package echoes

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
)

// Handler handles echo routes.
type Handler struct {
	pool    *pgxpool.Pool
	jwtPriv ed25519.PrivateKey
}

// NewHandler returns a Handler.
func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{pool: pool, jwtPriv: jwtPriv}
}

// Register mounts echo routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/echoes", h.list)
	mux.HandleFunc("POST /api/echoes/read", h.markRead)
}

type actorResp struct {
	ID        string  `json:"id"`
	Handle    string  `json:"handle"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatar_url,omitempty"`
	Color     string  `json:"color"`
}

type echoResp struct {
	ID           int64       `json:"id"`
	Type         string      `json:"type"`
	Actors       []actorResp `json:"actors"`
	ActorCount   int         `json:"actor_count"`
	SubjectID    *string     `json:"subject_id"`
	SubjectTitle *string     `json:"subject_title"`
	Read         bool        `json:"read"`
	CreatedAt    string      `json:"created_at"`
	UpdatedAt    string      `json:"updated_at"`
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}

	limit := 50
	cursor := r.URL.Query().Get("cursor")

	rows, err := db.ListEchoes(r.Context(), h.pool, userID, limit+1, cursor)
	if err != nil {
		log.Printf("echoes/list: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	var nextCursor string
	if len(rows) == limit+1 {
		last := rows[limit-1]
		nextCursor = db.EncodeEchoCursor(last.UpdatedAt, last.ID)
		rows = rows[:limit]
	}

	resp := make([]echoResp, 0, len(rows))
	unreadCount := 0
	for _, e := range rows {
		actors := make([]actorResp, 0, len(e.Actors))
		for _, a := range e.Actors {
			actors = append(actors, actorResp{
				ID:        a.ID,
				Handle:    a.Handle,
				Name:      a.Name,
				AvatarURL: a.AvatarURL,
				Color:     a.Color,
			})
		}
		er := echoResp{
			ID:           e.ID,
			Type:         e.Type,
			Actors:       actors,
			ActorCount:   e.ActorCount,
			SubjectID:    e.SubjectID,
			SubjectTitle: e.SubjectTitle,
			Read:         !e.Unread,
			CreatedAt:    e.CreatedAt.UTC().Format(time.RFC3339),
			UpdatedAt:    e.UpdatedAt.UTC().Format(time.RFC3339),
		}
		resp = append(resp, er)
		if e.Unread {
			unreadCount++
		}
	}

	result := map[string]any{
		"echoes":       resp,
		"unread_count": unreadCount,
	}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}
	if err := db.MarkEchoesRead(r.Context(), h.pool, userID); err != nil {
		log.Printf("echoes/markRead: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
