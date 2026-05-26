// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	DID string
	Bio *string
}

type Tokens struct {
	AccessToken  string
	RefreshToken string
	ExpiresAt    time.Time
	DPoPKeyID    string
}

// UpsertUser ensures a row exists for this DID. Bio is not touched — it is
// user-controlled and only changed via UpdateBio.
func UpsertUser(ctx context.Context, pool *pgxpool.Pool, did string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO users (did) VALUES ($1) ON CONFLICT (did) DO NOTHING
	`, did)
	return err
}

func UpsertTokens(ctx context.Context, pool *pgxpool.Pool, did string, t Tokens) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO user_tokens (did, access_token, refresh_token, access_token_expires_at, dpop_key_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (did) DO UPDATE
		  SET access_token            = EXCLUDED.access_token,
		      refresh_token           = EXCLUDED.refresh_token,
		      access_token_expires_at = EXCLUDED.access_token_expires_at,
		      dpop_key_id             = EXCLUDED.dpop_key_id,
		      updated_at              = now()
	`, did, t.AccessToken, t.RefreshToken, t.ExpiresAt, t.DPoPKeyID)
	return err
}

func GetUser(ctx context.Context, pool *pgxpool.Pool, did string) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `
		SELECT did, bio FROM users WHERE did = $1
	`, did).Scan(&u.DID, &u.Bio)
	if err == pgx.ErrNoRows {
		return User{}, fmt.Errorf("user not found: %s", did)
	}
	return u, err
}

func UpdateBio(ctx context.Context, pool *pgxpool.Pool, did, bio string) error {
	_, err := pool.Exec(ctx, `
		UPDATE users SET bio = $1, updated_at = now() WHERE did = $2
	`, bio, did)
	return err
}
