// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/juan-medina/agon/internal/auth"
	"github.com/juan-medina/agon/internal/db"
	"github.com/juan-medina/agon/internal/games"
	"github.com/juan-medina/agon/internal/journeys"
	"github.com/juan-medina/agon/internal/profile"
)

func main() {
	dpopPriv, err := loadECDSAKey(mustEnv("DPOP_KEY_FILE"))
	if err != nil {
		log.Fatalf("load DPoP key: %v\nRun `make gen-keys` first.", err)
	}
	jwtPriv, err := loadEd25519Key(mustEnv("SESSION_KEY_FILE"))
	if err != nil {
		log.Fatalf("load session key: %v\nRun `make gen-keys` first.", err)
	}

	cfg := auth.Config{
		ClientID:      mustEnv("BLUESKY_CLIENT_ID"),
		RedirectURI:   mustEnv("BLUESKY_REDIRECT_URI"),
		FrontendURL:   mustEnv("FRONTEND_URL"),
		AuthEndpoint:  mustEnv("BLUESKY_AUTH_ENDPOINT"),
		PAREndpoint:   mustEnv("BLUESKY_PAR_ENDPOINT"),
		TokenEndpoint: mustEnv("BLUESKY_TOKEN_ENDPOINT"),
	}

	addr := envOr("SERVER_ADDR", ":8080")
	allowedOrigin := mustEnv("ALLOWED_ORIGIN")

	pool, err := db.Connect(context.Background(), mustEnv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	igdbClient := games.NewClient(mustEnv("IGDB_CLIENT_ID"), mustEnv("IGDB_CLIENT_SECRET"))

	mux := http.NewServeMux()
	authHandler := auth.NewHandler(dpopPriv, jwtPriv, pool, cfg)
	authHandler.Register(mux)
	profile.NewHandler(pool, jwtPriv).Register(mux)
	games.NewHandler(igdbClient, pool).Register(mux)
	journeys.NewHandler(pool, jwtPriv, dpopPriv, os.Getenv("BLUESKY_PDS_URL")).Register(mux)

	log.Printf("listening on %s (frontend: %s)", addr, cfg.FrontendURL)
	if err := http.ListenAndServe(addr, cors(allowedOrigin, mux)); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// cors adds CORS headers for credentialed fetch requests from the frontend.
func cors(allowedOrigin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loadECDSAKey(path string) (*ecdsa.PrivateKey, error) {
	key, err := loadPKCS8Key(path)
	if err != nil {
		return nil, err
	}
	priv, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("%s does not contain a P-256 key (run `make gen-keys` to regenerate)", path)
	}
	return priv, nil
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
