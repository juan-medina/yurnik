// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ed25519"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/yurnik/internal/db"
)

// Config holds OAuth endpoints and application URLs.
type Config struct {
	ClientID     string // Discord application client ID
	ClientSecret string // Discord application client secret
	RedirectURI  string // e.g. http://127.0.0.1:8080/auth/callback
	FrontendURL  string // e.g. http://localhost:5173
	AuthEndpoint string // Discord authorize URL
	TokenEndpoint string // Discord token URL
	UserEndpoint  string // Discord user info URL
}

// Handler handles the Discord OAuth flow.
type Handler struct {
	jwtPriv ed25519.PrivateKey
	pool    *pgxpool.Pool
	store   *stateStore
	cfg     Config
}

// NewHandler returns a Handler.
func NewHandler(jwtPriv ed25519.PrivateKey, pool *pgxpool.Pool, cfg Config) *Handler {
	return &Handler{
		jwtPriv: jwtPriv,
		pool:    pool,
		store:   newStateStore(),
		cfg:     cfg,
	}
}

// Register mounts auth routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /auth/init", h.initAuth)
	mux.HandleFunc("GET /auth/callback", h.callback)
	mux.HandleFunc("POST /auth/session", h.session)
	mux.HandleFunc("POST /auth/logout", h.logout)
}

// initAuth generates a PKCE verifier and state nonce, stores them, sets the
// state in a cookie, and redirects the browser to the provider.
func (h *Handler) initAuth(w http.ResponseWriter, r *http.Request) {
	state, err := GenerateVerifier()
	if err != nil {
		log.Printf("auth/init: generate state: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	verifier, err := GenerateVerifier()
	if err != nil {
		log.Printf("auth/init: generate verifier: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	challenge := DeriveChallenge(verifier)

	h.store.put(state, verifier, 10*time.Minute)

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})

	params := url.Values{
		"client_id":             {h.cfg.ClientID},
		"redirect_uri":          {h.cfg.RedirectURI},
		"response_type":         {"code"},
		"scope":                 {"identify"},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
	http.Redirect(w, r, h.cfg.AuthEndpoint+"?"+params.Encode(), http.StatusFound)
}

// callback handles the provider redirect, exchanges the code for an access
// token, fetches the user's identity, upserts the user row, and redirects
// the browser to the frontend completion page.
func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	if errCode := r.URL.Query().Get("error"); errCode != "" {
		log.Printf("auth/callback: provider error: %s — %s", errCode, r.URL.Query().Get("error_description"))
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error="+url.QueryEscape(errCode), http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	// CSRF check: state cookie must match the state param.
	cookie, err := r.Cookie("auth_state")
	if err != nil || cookie.Value != state {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}

	entry, ok := h.store.get(state)
	if !ok {
		http.Error(w, "unknown or expired state", http.StatusBadRequest)
		return
	}

	accessToken, err := h.exchangeCode(r, code, entry.serverVerifier)
	if err != nil {
		log.Printf("auth/callback: exchange code: %v", err)
		http.Error(w, "token exchange failed", http.StatusBadGateway)
		return
	}

	identity, err := h.fetchIdentity(r, accessToken)
	if err != nil {
		log.Printf("auth/callback: fetch identity: %v", err)
		http.Error(w, "identity fetch failed", http.StatusBadGateway)
		return
	}

	userID, err := db.UpsertUser(r.Context(), h.pool, identity)
	if err != nil {
		log.Printf("auth/callback: upsert user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if !h.store.setUserID(state, userID) {
		http.Error(w, "state expired during exchange", http.StatusBadRequest)
		return
	}

	http.Redirect(w, r, h.cfg.FrontendURL+"/auth/complete", http.StatusFound)
}

// session looks up the completed OAuth state from the auth_state cookie,
// issues a signed session JWT, and sets it as an HttpOnly cookie.
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("auth_state")
	if err != nil {
		http.Error(w, "missing state cookie", http.StatusBadRequest)
		return
	}

	entry, ok := h.store.get(cookie.Value)
	if !ok || entry.userID == "" {
		http.Error(w, "state not found or auth pending", http.StatusBadRequest)
		return
	}

	user, err := db.GetUser(r.Context(), h.pool, entry.userID)
	if err != nil {
		log.Printf("auth/session: get user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if user.SuspendedAt != nil {
		http.Error(w, `{"error":"suspended"}`, http.StatusForbidden)
		return
	}

	tokenString, err := CreateSessionJWT(entry.userID, h.jwtPriv)
	if err != nil {
		log.Printf("auth/session: create JWT: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	h.store.delete(cookie.Value)

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "yurnik_session",
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"user_id": entry.userID})
}

// logout clears the session cookie.
func (h *Handler) logout(w http.ResponseWriter, _ *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:   "yurnik_session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

// exchangeCode swaps the authorization code for a provider access token.
func (h *Handler) exchangeCode(r *http.Request, code, verifier string) (string, error) {
	body := url.Values{
		"client_id":     {h.cfg.ClientID},
		"client_secret": {h.cfg.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {h.cfg.RedirectURI},
		"code_verifier": {verifier},
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		h.cfg.TokenEndpoint, strings.NewReader(body.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", &httpError{resp.StatusCode, string(b)}
	}

	var result struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.AccessToken, nil
}

// discordUser holds the fields we need from the provider's identity endpoint.
type discordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Avatar        string `json:"avatar"`
}

// fetchIdentity calls the provider's user info endpoint and returns a
// db.UserIdentity ready for upsert.
func (h *Handler) fetchIdentity(r *http.Request, accessToken string) (db.UserIdentity, error) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, h.cfg.UserEndpoint, nil)
	if err != nil {
		return db.UserIdentity{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return db.UserIdentity{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return db.UserIdentity{}, &httpError{resp.StatusCode, string(b)}
	}

	var u discordUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return db.UserIdentity{}, err
	}

	handle := u.Username
	name := u.GlobalName
	if name == "" {
		name = u.Username
	}

	var avatarURL string
	if u.Avatar != "" {
		avatarURL = "https://cdn.discordapp.com/avatars/" + u.ID + "/" + u.Avatar + ".png"
	}

	return db.UserIdentity{
		Provider:   "discord",
		ProviderID: u.ID,
		Handle:     handle,
		Name:       name,
		AvatarURL:  avatarURL,
	}, nil
}

type httpError struct {
	status int
	body   string
}

func (e *httpError) Error() string {
	return "http " + http.StatusText(e.status) + ": " + e.body
}
