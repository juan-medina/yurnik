// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// User is a row from the users table.
type User struct {
	ID        string
	Provider  string
	Handle    string
	Name      string
	AvatarURL *string
	Bio       *string
	Color     string
	IsAdmin   bool
}

// UserIdentity holds the identity fields returned by the OAuth provider.
// Passed to UpsertUser on every login.
type UserIdentity struct {
	Provider   string
	ProviderID string
	Handle     string
	Name       string
	AvatarURL  string
}

// UpsertUser inserts or updates the user row for the given provider identity
// and returns the internal UUID. Handle and avatar_url are refreshed on every
// login; bio and color are never touched here.
func UpsertUser(ctx context.Context, pool *pgxpool.Pool, identity UserIdentity) (string, error) {
	var id string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (provider, provider_id, handle, name, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (provider, provider_id) DO UPDATE
		  SET handle     = EXCLUDED.handle,
		      name       = EXCLUDED.name,
		      avatar_url = EXCLUDED.avatar_url,
		      updated_at = now()
		RETURNING id
	`, identity.Provider, identity.ProviderID, identity.Handle, identity.Name, nullableString(identity.AvatarURL)).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("upsert user: %w", err)
	}
	return id, nil
}

// GetUser returns the user row for the given internal UUID.
func GetUser(ctx context.Context, pool *pgxpool.Pool, id string) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `
		SELECT id, provider, handle, name, avatar_url, bio, color, is_admin
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.IsAdmin)
	if err == pgx.ErrNoRows {
		return User{}, fmt.Errorf("user not found: %s", id)
	}
	return u, err
}

// ListUsers returns all users ordered by name.
func ListUsers(ctx context.Context, pool *pgxpool.Pool) ([]User, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, provider, handle, name, avatar_url, bio, color, is_admin
		FROM users ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.IsAdmin); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// UpdateBio sets the bio for the given user ID.
func UpdateBio(ctx context.Context, pool *pgxpool.Pool, id, bio string) error {
	_, err := pool.Exec(ctx, `
		UPDATE users SET bio = $1, updated_at = now() WHERE id = $2
	`, bio, id)
	return err
}

// nullableString returns nil if s is empty, otherwise a pointer to s.
// Used to store optional provider fields as NULL rather than empty string.
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
