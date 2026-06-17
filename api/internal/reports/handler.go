// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package reports

import (
	"crypto/ed25519"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
	"github.com/juan-medina/yurnik/internal/middleware"
)

const (
	maxNoteLength    = 200
	reportMinInterval = 20 * time.Minute // 3 reports/hour before backoff
	reportMaxPenalty  = 24 * time.Hour
)

var validTargetTypes = map[string]bool{
	"journey_log": true,
	"comment":     true,
	"profile":     true,
}

var validReasons = map[string]bool{
	"spam":          true,
	"harassment":    true,
	"hate_speech":   true,
	"explicit":      true,
	"impersonation": true,
	"private_info":  true,
	"other":         true,
}

// Handler handles report submission and admin report listing.
type Handler struct {
	pool     *pgxpool.Pool
	jwtPriv  ed25519.PrivateKey
	velocity *middleware.VelocityLimiter
}

func NewHandler(pool *pgxpool.Pool, jwtPriv ed25519.PrivateKey) *Handler {
	return &Handler{
		pool:     pool,
		jwtPriv:  jwtPriv,
		velocity: middleware.NewVelocityLimiter(reportMinInterval, reportMaxPenalty),
	}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/reports", h.create)
	mux.HandleFunc("GET /api/admin/reports", h.list)
	mux.HandleFunc("POST /api/admin/users/{id}/suspend", h.suspend)
	mux.HandleFunc("DELETE /api/admin/users/{id}/suspend", h.unsuspend)
	mux.HandleFunc("GET /api/admin/users/suspended", h.listSuspended)
	mux.HandleFunc("POST /api/admin/users/{id}/reset-profile", h.resetProfile)
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

func (h *Handler) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}
	user, err := db.GetUser(r.Context(), h.pool, userID)
	if err != nil || !user.IsAdmin {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	return true
}

func (h *Handler) checkVelocity(w http.ResponseWriter, userID string) bool {
	if ok, retryAfter := h.velocity.Allow(userID); !ok {
		seconds := int(retryAfter.Round(time.Second) / time.Second)
		if seconds < 1 {
			seconds = 1
		}
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
		http.Error(w, `{"error":"too_many_requests"}`, http.StatusTooManyRequests)
		return false
	}
	return true
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if !h.checkVelocity(w, userID) {
		return
	}

	var body struct {
		TargetType string  `json:"target_type"`
		TargetID   string  `json:"target_id"`
		ContextID  *string `json:"context_id"`
		Reason     string  `json:"reason"`
		Note       *string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"bad_request"}`, http.StatusBadRequest)
		return
	}

	if !validTargetTypes[body.TargetType] {
		http.Error(w, `{"error":"invalid_target_type"}`, http.StatusBadRequest)
		return
	}
	if !validReasons[body.Reason] {
		http.Error(w, `{"error":"invalid_reason"}`, http.StatusBadRequest)
		return
	}
	if body.TargetID == "" {
		http.Error(w, `{"error":"missing_target_id"}`, http.StatusBadRequest)
		return
	}
	if body.Reason == "other" && (body.Note == nil || *body.Note == "") {
		http.Error(w, `{"error":"note_required_for_other"}`, http.StatusBadRequest)
		return
	}
	if body.Note != nil && utf8.RuneCountInString(*body.Note) > maxNoteLength {
		http.Error(w, `{"error":"note_too_long"}`, http.StatusBadRequest)
		return
	}

	inserted, err := db.InsertReport(r.Context(), h.pool, userID, body.TargetType, body.TargetID, body.ContextID, body.Reason, body.Note)
	if err != nil {
		log.Printf("reports/create: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	if !inserted {
		http.Error(w, `{"error":"already_reported"}`, http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(w, r) {
		return
	}

	reports, err := db.ListReports(r.Context(), h.pool)
	if err != nil {
		log.Printf("reports/list: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	type reportItem struct {
		ID              string  `json:"id"`
		ReporterHandle  string  `json:"reporter_handle"`
		ReporterName    string  `json:"reporter_name"`
		ReporterAvatar  *string `json:"reporter_avatar,omitempty"`
		ReporterColor   string  `json:"reporter_color"`
		TargetType      string  `json:"target_type"`
		TargetID        string  `json:"target_id"`
		ContextID       *string `json:"context_id,omitempty"`
		TargetHandle    *string `json:"target_handle,omitempty"`
		Reason          string  `json:"reason"`
		Note            *string `json:"note,omitempty"`
		CreatedAt       string  `json:"created_at"`
	}

	items := make([]reportItem, 0, len(reports))
	for _, rep := range reports {
		items = append(items, reportItem{
			ID:             rep.ID,
			ReporterHandle: rep.ReporterHandle,
			ReporterName:   rep.ReporterName,
			ReporterAvatar: rep.ReporterAvatar,
			ReporterColor:  rep.ReporterColor,
			TargetType:     rep.TargetType,
			TargetID:       rep.TargetID,
			ContextID:      rep.ContextID,
			TargetHandle:   rep.TargetHandle,
			Reason:         rep.Reason,
			Note:           rep.Note,
			CreatedAt:      rep.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"reports": items})
}

func (h *Handler) suspend(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if err := db.SuspendUser(r.Context(), h.pool, id); err != nil {
		log.Printf("admin/suspend: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unsuspend(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if err := db.UnsuspendUser(r.Context(), h.pool, id); err != nil {
		log.Printf("admin/unsuspend: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) resetProfile(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(w, r) {
		return
	}
	id := r.PathValue("id")
	if err := db.ResetProfile(r.Context(), h.pool, id); err != nil {
		log.Printf("admin/reset-profile: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listSuspended(w http.ResponseWriter, r *http.Request) {
	if !h.requireAdmin(w, r) {
		return
	}
	users, err := db.ListSuspendedUsers(r.Context(), h.pool)
	if err != nil {
		log.Printf("admin/list-suspended: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	type suspendedItem struct {
		ID          string  `json:"id"`
		Handle      string  `json:"handle"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url,omitempty"`
		Color       string  `json:"color"`
		SuspendedAt string  `json:"suspended_at"`
	}
	items := make([]suspendedItem, 0, len(users))
	for _, u := range users {
		items = append(items, suspendedItem{
			ID:          u.ID,
			Handle:      u.Handle,
			Name:        u.Name,
			AvatarURL:   u.AvatarURL,
			Color:       u.Color,
			SuspendedAt: u.SuspendedAt.UTC().Format(time.RFC3339),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"users": items})
}
