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
	ID              string
	Provider        string
	Handle          string
	Name            string
	AvatarURL       *string
	Bio             *string
	Color           string
	IsAdmin         bool
	HasCustomAvatar bool
	HasCustomName   bool
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
// login; bio, color, and custom_avatar_url are never touched here.
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

// UpdateAvatar sets the custom avatar URL for the given user ID.
// Pass an empty string to clear the custom avatar and fall back to the Discord avatar.
func UpdateAvatar(ctx context.Context, pool *pgxpool.Pool, userID, avatarURL string) error {
	_, err := pool.Exec(ctx, `
		UPDATE users SET custom_avatar_url = $1, updated_at = now() WHERE id = $2
	`, nullableString(avatarURL), userID)
	return err
}

// GetUser returns the user row for the given internal UUID.
func GetUser(ctx context.Context, pool *pgxpool.Pool, id string) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `
		SELECT id, provider, handle, COALESCE(display_name, name), COALESCE(custom_avatar_url, avatar_url), bio, color, is_admin,
		       custom_avatar_url IS NOT NULL, display_name IS NOT NULL
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.IsAdmin, &u.HasCustomAvatar, &u.HasCustomName)
	if err == pgx.ErrNoRows {
		return User{}, fmt.Errorf("user not found: %s", id)
	}
	return u, err
}

// ListUsers returns all users ordered by name.
func ListUsers(ctx context.Context, pool *pgxpool.Pool) ([]User, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, provider, handle, COALESCE(display_name, name), COALESCE(custom_avatar_url, avatar_url), bio, color, is_admin, false, false
		FROM users ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.IsAdmin, &u.HasCustomAvatar, &u.HasCustomName); err != nil {
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

// UpdateDisplayName sets the custom display name for the given user ID.
// Pass an empty string to clear it and fall back to the Discord name.
func UpdateDisplayName(ctx context.Context, pool *pgxpool.Pool, id, displayName string) error {
	_, err := pool.Exec(ctx, `
		UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2
	`, nullableString(displayName), id)
	return err
}

// FollowUser creates a follow relationship. Silently succeeds if already following.
func FollowUser(ctx context.Context, pool *pgxpool.Pool, followerID, followeeID string) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO follows (follower_id, followee_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, followerID, followeeID)
	return err
}

// UnfollowUser removes a follow relationship. Silently succeeds if not following.
func UnfollowUser(ctx context.Context, pool *pgxpool.Pool, followerID, followeeID string) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2
	`, followerID, followeeID)
	return err
}

// GetFollowers returns users who follow the given user ID, ordered by name.
func GetFollowers(ctx context.Context, pool *pgxpool.Pool, userID string) ([]User, error) {
	rows, err := pool.Query(ctx, `
		SELECT u.id, u.provider, u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.bio, u.color, u.is_admin, false, false
		FROM users u
		JOIN follows f ON f.follower_id = u.id
		WHERE f.followee_id = $1
		ORDER BY u.name
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get followers: %w", err)
	}
	return scanUsers(rows)
}

// GetFollowing returns users that the given user ID follows, ordered by name.
func GetFollowing(ctx context.Context, pool *pgxpool.Pool, userID string) ([]User, error) {
	rows, err := pool.Query(ctx, `
		SELECT u.id, u.provider, u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.bio, u.color, u.is_admin, false, false
		FROM users u
		JOIN follows f ON f.followee_id = u.id
		WHERE f.follower_id = $1
		ORDER BY u.name
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get following: %w", err)
	}
	return scanUsers(rows)
}

// GetFollowingIDs returns the set of user IDs that userID follows.
// Used to batch-check is_following across a list of players.
func GetFollowingIDs(ctx context.Context, pool *pgxpool.Pool, userID string) (map[string]bool, error) {
	rows, err := pool.Query(ctx, `
		SELECT followee_id FROM follows WHERE follower_id = $1
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get following ids: %w", err)
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		set[id] = true
	}
	return set, rows.Err()
}

// IsFollowing reports whether followerID follows followeeID.
func IsFollowing(ctx context.Context, pool *pgxpool.Pool, followerID, followeeID string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2)
	`, followerID, followeeID).Scan(&exists)
	return exists, err
}

// GetFollowCounts returns the follower and following counts for a user.
func GetFollowCounts(ctx context.Context, pool *pgxpool.Pool, userID string) (followers, following int, err error) {
	err = pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM follows WHERE followee_id = $1),
			(SELECT COUNT(*) FROM follows WHERE follower_id = $1)
	`, userID).Scan(&followers, &following)
	return
}

func scanUsers(rows pgx.Rows) ([]User, error) {
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.IsAdmin, &u.HasCustomAvatar, &u.HasCustomName); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// nullableString returns nil if s is empty, otherwise a pointer to s.
// Used to store optional provider fields as NULL rather than empty string.
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
