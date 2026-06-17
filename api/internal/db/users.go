// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"

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
	HasCustomAvatar bool
	HasCustomName   bool
	IsAdmin         bool
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
//
// Discord handles are unique on Discord but can be reassigned over time, so
// two Yurnik users can legitimately collide on a handle (one renamed away from
// it, the other later claimed it on Discord). When the incoming handle would
// collide with a different existing user, that other user is bumped to
// "{handle}_{random}" inside the same transaction, freeing the slug for the
// user logging in now. The bumped user reclaims a clean handle the next time
// they log in and no longer collide. If the bump itself collides (astronomically
// unlikely — would require two users to swap into the same handle and the same
// random suffix at once), the transaction is rolled back and the login fails;
// the user simply retries and gets a fresh random suffix.
func UpsertUser(ctx context.Context, pool *pgxpool.Pool, identity UserIdentity) (string, error) {
	var id string
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		var existingHandle *string
		err := tx.QueryRow(ctx, `SELECT handle FROM users WHERE provider = $1 AND provider_id = $2`,
			identity.Provider, identity.ProviderID).Scan(&existingHandle)
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("look up existing user: %w", err)
		}

		handleChanged := existingHandle == nil || !strings.EqualFold(*existingHandle, identity.Handle)
		if handleChanged {
			if err := bumpHandleHolder(ctx, tx, identity.Handle); err != nil {
				return err
			}
		}

		err = tx.QueryRow(ctx, `
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
			return fmt.Errorf("upsert user: %w", err)
		}
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("upsert user: %w", err)
	}
	return id, nil
}

// bumpHandleHolder renames whichever user currently holds handle (case-insensitive,
// excluding the row matching it exactly) to "{handle}_{random}", freeing the slug.
// No-op if nobody holds it.
func bumpHandleHolder(ctx context.Context, tx pgx.Tx, handle string) error {
	suffix, err := randomHex(4)
	if err != nil {
		return fmt.Errorf("generate handle suffix: %w", err)
	}
	_, err = tx.Exec(ctx, `
		UPDATE users SET handle = handle || '_' || $2, updated_at = now()
		WHERE lower(handle) = lower($1)
	`, handle, suffix)
	if err != nil {
		return fmt.Errorf("bump handle holder: %w", err)
	}
	return nil
}

// randomHex returns a random hex string of n bytes (2n hex characters).
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
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
		SELECT id, provider, handle, COALESCE(display_name, name), COALESCE(custom_avatar_url, avatar_url), bio, color,
		       custom_avatar_url IS NOT NULL, display_name IS NOT NULL, is_admin
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.HasCustomAvatar, &u.HasCustomName, &u.IsAdmin)
	if err == pgx.ErrNoRows {
		return User{}, fmt.Errorf("user not found: %s", id)
	}
	return u, err
}

// GetUserByHandle returns the user row for the given handle, matched
// case-insensitively (Discord handles are case-insensitive).
func GetUserByHandle(ctx context.Context, pool *pgxpool.Pool, handle string) (User, error) {
	var u User
	err := pool.QueryRow(ctx, `
		SELECT id, provider, handle, COALESCE(display_name, name), COALESCE(custom_avatar_url, avatar_url), bio, color,
		       custom_avatar_url IS NOT NULL, display_name IS NOT NULL, is_admin
		FROM users WHERE lower(handle) = lower($1)
	`, handle).Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.HasCustomAvatar, &u.HasCustomName, &u.IsAdmin)
	if err == pgx.ErrNoRows {
		return User{}, fmt.Errorf("user not found: %s", handle)
	}
	return u, err
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

// DeleteUser deletes the user row for the given internal UUID. All owned
// data (journeys, comments, follows, echoes, horizon entries, pending
// journeys, exclusions, and game hints) is removed via ON DELETE CASCADE.
func DeleteUser(ctx context.Context, pool *pgxpool.Pool, id string) error {
	_, err := pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
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
		SELECT u.id, u.provider, u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.bio, u.color, false, false
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
		SELECT u.id, u.provider, u.handle, COALESCE(u.display_name, u.name), COALESCE(u.custom_avatar_url, u.avatar_url), u.bio, u.color, false, false
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
		if err := rows.Scan(&u.ID, &u.Provider, &u.Handle, &u.Name, &u.AvatarURL, &u.Bio, &u.Color, &u.HasCustomAvatar, &u.HasCustomName); err != nil {
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
