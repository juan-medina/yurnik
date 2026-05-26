// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package auth

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juan-medina/agon/internal/db"
)

// Config holds OAuth endpoints and application URLs.
type Config struct {
	ClientID      string // e.g. http://localhost
	RedirectURI   string // e.g. http://127.0.0.1:8080/auth/callback
	FrontendURL   string // e.g. http://localhost:5173
	AuthEndpoint  string // Bluesky authorize URL
	PAREndpoint   string // Bluesky PAR URL (required by bsky.social)
	TokenEndpoint string // Bluesky token URL
}

// Handler handles the Bluesky OAuth flow.
type Handler struct {
	dpopPriv *ecdsa.PrivateKey
	jwtPriv  ed25519.PrivateKey
	jwtPub   ed25519.PublicKey
	pool     *pgxpool.Pool
	store    *stateStore
	cfg      Config
}

func NewHandler(dpopPriv *ecdsa.PrivateKey, jwtPriv ed25519.PrivateKey, pool *pgxpool.Pool, cfg Config) *Handler {
	return &Handler{
		dpopPriv: dpopPriv,
		jwtPriv:  jwtPriv,
		jwtPub:   jwtPriv.Public().(ed25519.PublicKey),
		pool:     pool,
		store:    newStateStore(),
		cfg:      cfg,
	}
}

// JWTPub returns the public key used to verify session JWTs.
func (h *Handler) JWTPub() ed25519.PublicKey {
	return h.jwtPub
}

// effectiveClientID returns the client_id to send to Bluesky.
//
// For the AT Proto loopback exception (client_id=http://localhost), the
// authorization server cannot fetch remote metadata, so allowed redirect URIs
// must be embedded as query parameters in the client_id URL itself:
//
//	http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A8080%2Fauth%2Fcallback
//
// The AS parses the query params to build the virtual client metadata rather
// than making an outbound request.
func (h *Handler) effectiveClientID() string {
	if h.cfg.ClientID != "http://localhost" {
		return h.cfg.ClientID
	}
	q := url.Values{}
	q.Set("redirect_uri", h.cfg.RedirectURI)
	return "http://localhost?" + q.Encode()
}

// Register mounts auth routes on mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /.well-known/oauth-client-metadata.json", h.clientMetadata)
	mux.HandleFunc("GET /auth/init", h.initAuth)
	mux.HandleFunc("GET /auth/callback", h.callback)
	mux.HandleFunc("POST /auth/session", h.session)
	mux.HandleFunc("POST /auth/logout", h.logout)
}

// clientMetadata serves AT Proto OAuth client metadata.
func (h *Handler) clientMetadata(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"client_id":                  h.effectiveClientID(),
		"client_name":                "Agōn",
		"redirect_uris":              []string{h.cfg.RedirectURI},
		"grant_types":                []string{"authorization_code"},
		"response_types":             []string{"code"},
		"scope":                      "atproto",
		"token_endpoint_auth_method": "none",
		"application_type":           "native",
		"dpop_bound_access_tokens":   true,
	})
}

// initAuth generates a random OAuth state value, pushes the authorization
// request to Bluesky via PAR, stores the state in a cookie for CSRF validation,
// then redirects the browser to the Bluesky authorize endpoint.
func (h *Handler) initAuth(w http.ResponseWriter, r *http.Request) {
	state, err := GenerateVerifier()
	if err != nil {
		log.Printf("auth/init: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	serverVerifier, err := GenerateVerifier()
	if err != nil {
		log.Printf("auth/init: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	serverChallenge := DeriveChallenge(serverVerifier)

	h.store.put(state, serverVerifier, 10*time.Minute)

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})

	requestURI, err := h.doPAR(state, serverChallenge)
	if err != nil {
		log.Printf("auth/init: PAR: %v", err)
		http.Error(w, "authorization request failed", http.StatusBadGateway)
		return
	}

	params := url.Values{
		"client_id":   {h.effectiveClientID()},
		"request_uri": {requestURI},
	}
	http.Redirect(w, r, h.cfg.AuthEndpoint+"?"+params.Encode(), http.StatusFound)
}

type parResult struct {
	requestURI string
	retryNonce string
}

// doPAR pushes authorization parameters to Bluesky's PAR endpoint, retrying
// once with a DPoP nonce if the server demands one.
func (h *Handler) doPAR(state, serverChallenge string) (string, error) {
	nonce := ""
	for attempt := 0; attempt < 2; attempt++ {
		result, err := h.doPARRequest(state, serverChallenge, nonce)
		if err != nil {
			return "", err
		}
		if result.retryNonce != "" {
			nonce = result.retryNonce
			continue
		}
		return result.requestURI, nil
	}
	return "", fmt.Errorf("exhausted DPoP nonce retries for PAR")
}

func (h *Handler) doPARRequest(state, serverChallenge, nonce string) (parResult, error) {
	dpopProof, err := CreateDPoPProof(h.dpopPriv, "POST", h.cfg.PAREndpoint, nonce)
	if err != nil {
		return parResult{}, fmt.Errorf("dpop proof: %w", err)
	}

	body := url.Values{
		"response_type":         {"code"},
		"client_id":             {h.effectiveClientID()},
		"redirect_uri":          {h.cfg.RedirectURI},
		"scope":                 {"atproto"},
		"state":                 {state},
		"code_challenge":        {serverChallenge},
		"code_challenge_method": {"S256"},
	}

	req, err := http.NewRequest(http.MethodPost, h.cfg.PAREndpoint, strings.NewReader(body.Encode()))
	if err != nil {
		return parResult{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("DPoP", dpopProof)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return parResult{}, fmt.Errorf("PAR request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusCreated {
		dpopNonce := resp.Header.Get("DPoP-Nonce")
		log.Printf("PAR %d body=%s dpop-nonce=%s", resp.StatusCode, respBody, dpopNonce)
		// Retry once if the server demands a fresh DPoP nonce.
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(respBody, &errResp)
		if errResp.Error == "use_dpop_nonce" && dpopNonce != "" {
			return parResult{retryNonce: dpopNonce}, nil
		}
		return parResult{}, fmt.Errorf("PAR endpoint %d: %s", resp.StatusCode, respBody)
	}

	var pr struct {
		RequestURI string `json:"request_uri"`
	}
	if err := json.Unmarshal(respBody, &pr); err != nil {
		return parResult{}, fmt.Errorf("decode PAR response: %w", err)
	}
	if pr.RequestURI == "" {
		return parResult{}, fmt.Errorf("missing request_uri in PAR response")
	}
	return parResult{requestURI: pr.RequestURI}, nil
}

// callback receives the authorization code from Bluesky, exchanges it for a
// DID, stores the result, then redirects the browser to the frontend.
func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	// Bluesky signals errors via query params even when redirecting to our URI.
	if errCode := r.URL.Query().Get("error"); errCode != "" {
		log.Printf("auth/callback: Bluesky error: %s — %s", errCode, r.URL.Query().Get("error_description"))
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error="+url.QueryEscape(errCode), http.StatusFound)
		return
	}

	code := r.URL.Query().Get("code")
	challenge := r.URL.Query().Get("state")

	if code == "" || challenge == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	// CSRF check: auth_state cookie was set by initAuth; Bluesky echoes the
	// state param back on redirect. Cookie must match to confirm this is our flow.
	cookie, err := r.Cookie("auth_state")
	if err != nil || cookie.Value != challenge {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}

	entry, ok := h.store.get(challenge)
	if !ok {
		http.Error(w, "unknown or expired state", http.StatusBadRequest)
		return
	}

	tokens, err := h.exchangeCode(code, entry.serverVerifier)
	if err != nil {
		log.Printf("auth/callback: %v", err)
		http.Error(w, "token exchange failed", http.StatusBadGateway)
		return
	}

	if err := db.UpsertUser(r.Context(), h.pool, tokens.did); err != nil {
		log.Printf("auth/callback: upsert user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := db.UpsertTokens(r.Context(), h.pool, tokens.did, db.Tokens{
		AccessToken:  tokens.accessToken,
		RefreshToken: tokens.refreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(tokens.expiresIn) * time.Second),
		DPoPKeyID:    "default",
	}); err != nil {
		log.Printf("auth/callback: upsert tokens: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if !h.store.setDID(challenge, tokens.did) {
		http.Error(w, "state expired during exchange", http.StatusBadRequest)
		return
	}

	http.Redirect(w, r, h.cfg.FrontendURL+"/auth/complete", http.StatusFound)
}

// session looks up the completed OAuth state from the auth_state cookie,
// issues a signed session JWT, and returns the DID.
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("auth_state")
	if err != nil {
		http.Error(w, "missing state cookie", http.StatusBadRequest)
		return
	}
	state := cookie.Value

	entry, ok := h.store.get(state)
	if !ok || entry.did == "" {
		http.Error(w, "state not found or auth pending", http.StatusBadRequest)
		return
	}

	tokenString, err := CreateSessionJWT(entry.did, h.jwtPriv)
	if err != nil {
		log.Printf("auth/session: create JWT: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	h.store.delete(state)

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "agon_session",
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"did": entry.did})
}

// logout clears the session cookie.
func (h *Handler) logout(w http.ResponseWriter, _ *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:   "agon_session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

type tokenResult struct {
	did          string
	accessToken  string
	refreshToken string
	expiresIn    int
}

type exchangeResult struct {
	tokenResult
	retryNonce string
}

// exchangeCode swaps an authorization code for tokens using the Bluesky token
// endpoint. It retries once if the server demands a DPoP nonce.
func (h *Handler) exchangeCode(code, serverVerifier string) (tokenResult, error) {
	nonce := ""
	for attempt := 0; attempt < 2; attempt++ {
		result, err := h.doTokenExchange(code, serverVerifier, nonce)
		if err != nil {
			return tokenResult{}, err
		}
		if result.retryNonce != "" {
			nonce = result.retryNonce
			continue
		}
		return result.tokenResult, nil
	}
	return tokenResult{}, fmt.Errorf("exhausted DPoP nonce retries")
}

func (h *Handler) doTokenExchange(code, serverVerifier, nonce string) (exchangeResult, error) {
	dpopProof, err := CreateDPoPProof(h.dpopPriv, "POST", h.cfg.TokenEndpoint, nonce)
	if err != nil {
		return exchangeResult{}, fmt.Errorf("dpop proof: %w", err)
	}

	body := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {h.cfg.RedirectURI},
		"client_id":     {h.effectiveClientID()},
		"code_verifier": {serverVerifier},
	}

	req, err := http.NewRequest(http.MethodPost, h.cfg.TokenEndpoint, strings.NewReader(body.Encode()))
	if err != nil {
		return exchangeResult{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("DPoP", dpopProof)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return exchangeResult{}, fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusBadRequest {
		if dpopNonce := resp.Header.Get("DPoP-Nonce"); dpopNonce != "" {
			return exchangeResult{retryNonce: dpopNonce}, nil
		}
	}

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return exchangeResult{}, fmt.Errorf("token endpoint %d: %s", resp.StatusCode, b)
	}

	var tr struct {
		Sub          string `json:"sub"`
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return exchangeResult{}, fmt.Errorf("decode response: %w", err)
	}
	if tr.Sub == "" || tr.AccessToken == "" || tr.RefreshToken == "" {
		return exchangeResult{}, fmt.Errorf("missing required fields in token response")
	}
	expiresIn := tr.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600 // Bluesky default
	}
	return exchangeResult{tokenResult: tokenResult{
		did:          tr.Sub,
		accessToken:  tr.AccessToken,
		refreshToken: tr.RefreshToken,
		expiresIn:    expiresIn,
	}}, nil
}

