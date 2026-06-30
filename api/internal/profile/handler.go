// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package profile

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
	mux.HandleFunc("PUT /api/me/preferences", h.putPreferences)
	mux.HandleFunc("DELETE /api/me", h.deleteMe)
	mux.HandleFunc("POST /api/me/avatar", h.uploadAvatar)
	mux.HandleFunc("DELETE /api/me/avatar", h.deleteAvatar)
	mux.HandleFunc("GET /api/feed", h.getFeed)
	mux.HandleFunc("GET /api/players/search", h.searchPlayers)
	mux.HandleFunc("GET /api/players/{handle}", h.getPlayer)
	mux.HandleFunc("GET /api/players/{handle}/profile", h.getPlayerProfile)
	mux.HandleFunc("GET /api/players/{handle}/activity", h.getPlayerActivity)
	mux.HandleFunc("GET /api/players/{handle}/followers", h.getFollowers)
	mux.HandleFunc("GET /api/players/{handle}/following", h.getFollowing)
	mux.HandleFunc("POST /api/players/{handle}/follow", h.followPlayer)
	mux.HandleFunc("DELETE /api/players/{handle}/follow", h.unfollowPlayer)
}

// resolvePlayer resolves the {handle} path segment to a user.
// Returns ok=false if an error response has already been written.
func (h *Handler) resolvePlayer(w http.ResponseWriter, r *http.Request) (db.User, bool) {
	value := r.PathValue("handle")
	user, err := db.GetUserByHandle(r.Context(), h.pool, value)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return db.User{}, false
	}
	return user, true
}


type meResponse struct {
	ID              string  `json:"id"`
	Handle          string  `json:"handle"`
	Name            string  `json:"name"`
	AvatarURL       *string `json:"avatar_url"`
	Bio             *string `json:"bio"`
	Color           string  `json:"color"`
	HasCustomAvatar         bool                       `json:"has_custom_avatar"`
	HasCustomName           bool                       `json:"has_custom_name"`
	IsAdmin                 bool                       `json:"is_admin"`
	NotificationPreferences db.NotificationPreferences `json:"notification_preferences"`
}

func (h *Handler) getMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
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
	if user.SuspendedAt != nil {
		http.Error(w, `{"error":"suspended"}`, http.StatusForbidden)
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
		HasCustomAvatar:         user.HasCustomAvatar,
		HasCustomName:           user.HasCustomName,
		IsAdmin:                 user.IsAdmin,
		NotificationPreferences: user.NotificationPreferences,
	})
}

// maxSearchResults caps @mention autocomplete results — a typeahead dropdown
// only ever shows a handful of candidates.
const maxSearchResults = 8

// searchPlayers returns handle-prefix matches for @mention autocomplete.
// Requires auth so it can't be used as an unauthenticated user enumeration
// endpoint; an empty or missing q returns no results.
func (h *Handler) searchPlayers(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool); !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	q := strings.TrimPrefix(r.URL.Query().Get("q"), "@")
	users, err := db.SearchUsersByHandlePrefix(r.Context(), h.pool, q, maxSearchResults)
	if err != nil {
		log.Printf("profile/searchPlayers: %v", err)
		http.Error(w, `{"error":"internal_error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"players": usersToPlayerItems(users)})
}

func (h *Handler) getPlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	id := user.ID

	followers, following, err := db.GetFollowCounts(r.Context(), h.pool, id)
	if err != nil {
		log.Printf("profile/player: follow counts %s: %v", id, err)
	}

	isFollowing := false
	if callerID, ok := auth.TryAuthenticate(w, r, h.jwtPriv, h.pool); ok {
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
		IsAdmin     bool    `json:"is_admin"`
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
		IsAdmin:     user.IsAdmin,
	})
}

func (h *Handler) followPlayer(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	target, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	targetID := target.ID
	if callerID == targetID {
		http.Error(w, "cannot follow yourself", http.StatusBadRequest)
		return
	}
	if err := db.FollowUser(r.Context(), h.pool, callerID, targetID); err != nil {
		log.Printf("profile/follow: %s -> %s: %v", callerID, targetID, err)
		http.Error(w, "follow failed", http.StatusInternalServerError)
		return
	}

	// Best-effort echo/activity — never block the response on these failures.
	if err := db.UpsertFollowerEcho(r.Context(), h.pool, targetID, callerID); err != nil {
		log.Printf("profile/follow: upsert echo: %v", err)
	}
	if err := db.RecordActivity(r.Context(), h.pool, callerID, targetID, "new_follower", nil, nil, nil); err != nil {
		log.Printf("profile/follow: record activity: %v", err)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unfollowPlayer(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	target, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	targetID := target.ID
	if err := db.UnfollowUser(r.Context(), h.pool, callerID, targetID); err != nil {
		log.Printf("profile/unfollow: %s -> %s: %v", callerID, targetID, err)
		http.Error(w, "unfollow failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getFollowers(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	limit := 50
	if s := r.URL.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")
	users, err := db.GetFollowers(r.Context(), h.pool, user.ID, limit+1, cursor)
	if err != nil {
		log.Printf("profile/followers: %s: %v", user.ID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	result := map[string]any{"players": usersToPlayerItems(users)}
	if len(users) == limit+1 {
		last := users[limit-1]
		result["players"] = usersToPlayerItems(users[:limit])
		result["next_cursor"] = db.EncodeFollowCursor(last.Name, last.ID)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *Handler) getFollowing(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	limit := 50
	if s := r.URL.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	cursor := r.URL.Query().Get("cursor")
	users, err := db.GetFollowing(r.Context(), h.pool, user.ID, limit+1, cursor)
	if err != nil {
		log.Printf("profile/following: %s: %v", user.ID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	result := map[string]any{"players": usersToPlayerItems(users)}
	if len(users) == limit+1 {
		last := users[limit-1]
		result["players"] = usersToPlayerItems(users[:limit])
		result["next_cursor"] = db.EncodeFollowCursor(last.Name, last.ID)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
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
	ReleaseYear     *int       `json:"release_year,omitempty"`
	DurationSeconds int        `json:"duration_seconds"`
	Log             *string    `json:"log,omitempty"`
	PlayedAt        string     `json:"played_at"`
	Player          playerResp `json:"player"`
}

type activityResp struct {
	Type          string     `json:"type"` // "follow" | "comment" | "horizon_add"
	CreatedAt     string     `json:"created_at"`
	Actor         playerResp `json:"actor"`
	Recipient     playerResp `json:"recipient"`
	SubjectID     *string    `json:"subject_id,omitempty"`
	SubjectTitle  *string    `json:"subject_title,omitempty"`
	SubjectIGDBID *int       `json:"subject_igdb_id,omitempty"`
}

type feedItem struct {
	Kind     string        `json:"kind"` // "journey" | "activity"
	Journey  *feedEntry    `json:"journey,omitempty"`
	Activity *activityResp `json:"activity,omitempty"`
}

func journeyToFeedEntry(j db.JourneyWithPlayer) feedEntry {
	return feedEntry{
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
	}
}

func activityToFeedEntry(a db.ActivityEvent) activityResp {
	t := "comment"
	switch a.Type {
	case "new_follower":
		t = "follow"
	case "horizon_add":
		t = "horizon_add"
	}
	return activityResp{
		Type:      t,
		CreatedAt: a.CreatedAt.UTC().Format(time.RFC3339),
		Actor: playerResp{
			ID:        a.ActorID,
			Handle:    a.ActorHandle,
			Name:      a.ActorName,
			AvatarURL: a.ActorAvatarURL,
			Color:     a.ActorColor,
		},
		Recipient: playerResp{
			ID:        a.RecipientID,
			Handle:    a.RecipientHandle,
			Name:      a.RecipientName,
			AvatarURL: a.RecipientAvatarURL,
			Color:     a.RecipientColor,
		},
		SubjectID:     a.SubjectID,
		SubjectTitle:  a.SubjectTitle,
		SubjectIGDBID: a.SubjectIGDBID,
	}
}

// mergeFeedItems interleaves journeys (ordered by CreatedAt desc — when they
// were logged, not the day they represent) and activity events (ordered by
// CreatedAt desc) into a single feed, most recent first, truncated to limit.
// It returns the combined items and the next cursor
// (journeyCursor + "|" + activityCursor), or "" if both sources are
// exhausted. journeys and activity must each contain at most limit+1 items,
// as returned by the corresponding Get* DB functions.
func mergeFeedItems(
	journeys []db.JourneyWithPlayer, activity []db.ActivityEvent, limit int,
	journeyCursor, activityCursor string,
) ([]feedItem, string) {
	journeyMore := len(journeys) > limit
	if journeyMore {
		journeys = journeys[:limit]
	}
	activityMore := len(activity) > limit
	if activityMore {
		activity = activity[:limit]
	}

	items := make([]feedItem, 0, limit)
	ji, ai := 0, 0
	for len(items) < limit && (ji < len(journeys) || ai < len(activity)) {
		takeJourney := ji < len(journeys) && (ai >= len(activity) || !journeys[ji].CreatedAt.Before(activity[ai].CreatedAt))
		if takeJourney {
			entry := journeyToFeedEntry(journeys[ji])
			items = append(items, feedItem{Kind: "journey", Journey: &entry})
			journeyCursor = db.EncodeJourneyCursor(journeys[ji].PlayedAt, journeys[ji].CreatedAt)
			ji++
		} else {
			entry := activityToFeedEntry(activity[ai])
			items = append(items, feedItem{Kind: "activity", Activity: &entry})
			activityCursor = activity[ai].CreatedAt.UTC().Format(time.RFC3339)
			ai++
		}
	}

	hasMore := journeyMore || activityMore || ji < len(journeys) || ai < len(activity)
	if !hasMore {
		return items, ""
	}
	return items, journeyCursor + "|" + activityCursor
}

func (h *Handler) getFeed(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		return
	}

	limit := 20
	if s := r.URL.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	journeyCursor, activityCursor := "", ""
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		if before, after, found := strings.Cut(cursor, "|"); found {
			journeyCursor, activityCursor = before, after
		}
	}

	journeys, err := db.GetFollowingFeed(r.Context(), h.pool, userID, limit+1, journeyCursor)
	if err != nil {
		log.Printf("profile/feed: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	activity, err := db.GetFollowingActivity(r.Context(), h.pool, userID, limit+1, activityCursor)
	if err != nil {
		log.Printf("profile/feed: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	items, nextCursor := mergeFeedItems(journeys, activity, limit, journeyCursor, activityCursor)

	result := map[string]any{"items": items}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// journeyWithPlayer attaches the given user's profile fields to a journey,
// for reuse with mergeFeedItems/journeyToFeedEntry.
func journeyWithPlayer(j db.Journey, user db.User) db.JourneyWithPlayer {
	return db.JourneyWithPlayer{
		ID:              j.ID,
		UserID:          j.UserID,
		IGDBID:          j.IGDBID,
		GameName:        j.GameName,
		CoverURL:        j.CoverURL,
		Genres:          j.Genres,
		ReleaseYear:     j.ReleaseYear,
		DurationSeconds: j.DurationSeconds,
		Log:             j.Log,
		PlayedAt:        j.PlayedAt,
		CreatedAt:       j.CreatedAt,
		PlayerHandle:    user.Handle,
		PlayerName:      user.Name,
		PlayerAvatarURL: user.AvatarURL,
		PlayerColor:     user.Color,
	}
}

// getPlayerActivity returns a merged feed of the given player's own
// journeys and activity events they triggered (follows, comments), in the
// same shape as getFeed.
func (h *Handler) getPlayerActivity(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}

	limit := 20
	if s := r.URL.Query().Get("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 && n <= 50 {
			limit = n
		}
	}

	journeyCursor, activityCursor := "", ""
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		if before, after, found := strings.Cut(cursor, "|"); found {
			journeyCursor, activityCursor = before, after
		}
	}

	journeys, err := db.ListJourneysByUser(r.Context(), h.pool, user.ID, limit+1, journeyCursor)
	if err != nil {
		log.Printf("profile/activity: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	journeysWithPlayer := make([]db.JourneyWithPlayer, len(journeys))
	for i, j := range journeys {
		journeysWithPlayer[i] = journeyWithPlayer(j, user)
	}

	activity, err := db.GetUserActivity(r.Context(), h.pool, user.ID, limit+1, activityCursor)
	if err != nil {
		log.Printf("profile/activity: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	items, nextCursor := mergeFeedItems(journeysWithPlayer, activity, limit, journeyCursor, activityCursor)

	result := map[string]any{"items": items}
	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

type recentGameItem struct {
	IGDBID        int     `json:"igdb_id"`
	Name          string  `json:"name"`
	CoverURL      *string `json:"cover_url,omitempty"`
	ReleaseYear   *int    `json:"release_year,omitempty"`
	LastPlayed    string  `json:"last_played"`
	SecondsPlayed int     `json:"seconds_played"`
}

type genreHoursItem struct {
	Genre   string `json:"genre"`
	Seconds int    `json:"seconds"`
}

type horizonItem struct {
	IGDBID      int      `json:"igdb_id"`
	Name        string   `json:"name"`
	CoverURL    *string  `json:"cover_url,omitempty"`
	Genres      []string `json:"genres"`
	ReleaseYear *int     `json:"release_year,omitempty"`
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
	IsAdmin      bool             `json:"is_admin"`
	JourneyCount int              `json:"journey_count"`
	TotalSeconds int              `json:"total_seconds"`
	RecentGames  []recentGameItem `json:"recent_games"`
	GenreHours   []genreHoursItem `json:"genre_hours"`
	Horizon      []horizonItem    `json:"horizon"`
}

func buildProfileSummaryResponse(user db.User, followers, following int, isFollowing bool, summary db.ProfileSummary, horizon []db.HorizonEntry) profileSummaryResponse {
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
		IsAdmin:      user.IsAdmin,
		JourneyCount: summary.JourneyCount,
		TotalSeconds: summary.TotalSeconds,
		RecentGames:  make([]recentGameItem, 0, len(summary.RecentGames)),
		GenreHours:   make([]genreHoursItem, 0, len(summary.GenreHours)),
		Horizon:      make([]horizonItem, 0, len(horizon)),
	}
	for _, g := range summary.RecentGames {
		resp.RecentGames = append(resp.RecentGames, recentGameItem{
			IGDBID:        g.IGDBID,
			Name:          g.Name,
			CoverURL:      g.CoverURL,
			ReleaseYear:   g.ReleaseYear,
			LastPlayed:    g.LastPlayed.UTC().Format(time.RFC3339),
			SecondsPlayed: g.SecondsPlayed,
		})
	}
	for _, gh := range summary.GenreHours {
		resp.GenreHours = append(resp.GenreHours, genreHoursItem{Genre: gh.Genre, Seconds: gh.Seconds})
	}
	for _, e := range horizon {
		genres := e.Genres
		if genres == nil {
			genres = []string{}
		}
		resp.Horizon = append(resp.Horizon, horizonItem{
			IGDBID:      e.IGDBID,
			Name:        e.Name,
			CoverURL:    e.CoverURL,
			Genres:      genres,
			ReleaseYear: e.ReleaseYear,
		})
	}
	return resp
}

func (h *Handler) getMeProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	user, err := db.GetUser(r.Context(), h.pool, userID)
	if err != nil {
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
		return
	}
	h.writeProfileSummary(w, r, user, false)
}

func (h *Handler) getPlayerProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolvePlayer(w, r)
	if !ok {
		return
	}
	isFollowing := false
	if callerID, ok := auth.TryAuthenticate(w, r, h.jwtPriv, h.pool); ok {
		isFollowing, _ = db.IsFollowing(r.Context(), h.pool, callerID, user.ID)
	}
	h.writeProfileSummary(w, r, user, isFollowing)
}

func (h *Handler) writeProfileSummary(w http.ResponseWriter, r *http.Request, user db.User, isFollowing bool) {
	userID := user.ID
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
	horizonEntries, err := db.ListHorizonEntries(r.Context(), h.pool, userID)
	if err != nil {
		log.Printf("profile/summary: horizon %s: %v", userID, err)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(buildProfileSummaryResponse(user, followers, following, isFollowing, summary, horizonEntries))
}

func (h *Handler) patchMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
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
		if len([]rune(*body.Bio)) > 400 {
			http.Error(w, `{"error":"invalid_request","message":"bio must be at most 400 characters"}`, http.StatusBadRequest)
			return
		}
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

func (h *Handler) putPreferences(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body db.NotificationPreferences
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if err := db.UpdateNotificationPreferences(r.Context(), h.pool, userID, body); err != nil {
		log.Printf("profile/me: update preferences %s: %v", userID, err)
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// deleteMe permanently deletes the caller's account. All owned data is
// removed via ON DELETE CASCADE on the users row. The session cookie is
// cleared so the now-stale JWT is dropped by the browser.
func (h *Handler) deleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := db.DeleteUser(r.Context(), h.pool, userID); err != nil {
		log.Printf("profile/me: delete %s: %v", userID, err)
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "yurnik_session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

// deleteAvatar clears the custom avatar, reverting to the Discord avatar.
func (h *Handler) deleteAvatar(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
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

	userID, ok := auth.Authenticate(w, r, h.jwtPriv, h.pool)
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
