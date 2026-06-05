// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/juan-medina/yurnik/internal/admin"
	"github.com/juan-medina/yurnik/internal/agent"
	"github.com/juan-medina/yurnik/internal/auth"
	"github.com/juan-medina/yurnik/internal/db"
	"github.com/juan-medina/yurnik/internal/echoes"
	"github.com/juan-medina/yurnik/internal/games"
	"github.com/juan-medina/yurnik/internal/journeys"
	"github.com/juan-medina/yurnik/internal/middleware"
	"github.com/juan-medina/yurnik/internal/profile"
	"github.com/juan-medina/yurnik/internal/r2"
	"github.com/juan-medina/yurnik/internal/settings"
)

func main() {
	jwtPriv, err := loadEd25519Key(mustEnv("SESSION_KEY_FILE"))
	if err != nil {
		log.Fatalf("load session key: %v\nRun `make gen-keys` first.", err)
	}

	cfg := auth.Config{
		ClientID:      mustEnv("DISCORD_CLIENT_ID"),
		ClientSecret:  mustEnv("DISCORD_CLIENT_SECRET"),
		RedirectURI:   mustEnv("DISCORD_REDIRECT_URI"),
		FrontendURL:   mustEnv("FRONTEND_URL"),
		AuthEndpoint:  mustEnv("DISCORD_AUTH_ENDPOINT"),
		TokenEndpoint: mustEnv("DISCORD_TOKEN_ENDPOINT"),
		UserEndpoint:  mustEnv("DISCORD_USER_ENDPOINT"),
	}

	addr := envOr("SERVER_ADDR", ":8080")
	allowedOrigin := mustEnv("ALLOWED_ORIGIN")

	rpsStr := envOr("RATE_LIMIT_RPS", "100")
	rps, err := strconv.ParseFloat(rpsStr, 64)
	if err != nil || rps <= 0 {
		log.Fatalf("invalid RATE_LIMIT_RPS %q: must be a positive number", rpsStr)
	}

	pool, err := db.Connect(context.Background(), mustEnv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	igdbClient := games.NewClient(mustEnv("IGDB_CLIENT_ID"), mustEnv("IGDB_CLIENT_SECRET"))

	r2Client := r2.NewClient(r2.Config{
		AccountID:       mustEnv("R2_ACCOUNT_ID"),
		AccessKeyID:     mustEnv("R2_ACCESS_KEY_ID"),
		SecretAccessKey: mustEnv("R2_SECRET_ACCESS_KEY"),
		Bucket:          mustEnv("R2_BUCKET"),
		PublicURL:       mustEnv("R2_PUBLIC_URL"),
	})

	mux := http.NewServeMux()
	auth.NewHandler(jwtPriv, pool, cfg).Register(mux)
	agent.NewHandler(pool, jwtPriv).Register(mux)
	profile.NewHandler(pool, jwtPriv, r2Client).Register(mux)
	games.NewHandler(igdbClient, pool).Register(mux)
	journeys.NewHandler(pool, jwtPriv).Register(mux)
	echoes.NewHandler(pool, jwtPriv).Register(mux)
	settings.NewHandler(pool, jwtPriv).Register(mux)
	admin.NewHandler(pool, jwtPriv).Register(mux)

	log.Printf("listening on %s (frontend: %s, rate limit: %.0f rps)", addr, cfg.FrontendURL, rps)
	if err := http.ListenAndServe(addr, cors(allowedOrigin, middleware.RateLimit(rps, mux))); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// cors adds CORS headers for credentialed fetch requests from the frontend.
func cors(allowedOrigin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loadEd25519Key(path string) (ed25519.PrivateKey, error) {
	key, err := loadPKCS8Key(path)
	if err != nil {
		return nil, err
	}
	priv, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("%s does not contain an Ed25519 key (run `make gen-keys` to regenerate)", path)
	}
	return priv, nil
}

func loadPKCS8Key(path string) (interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("no PEM block in %s", path)
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse key in %s: %w", path, err)
	}
	return key, nil
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %s is not set", key)
	}
	return v
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
