// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package db

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ProfileRecentGame struct {
	IGDBID        int
	Name          string
	CoverURL      *string
	ReleaseYear   *int
	LastPlayed    time.Time
	SecondsPlayed int
}

type ProfileGenreHours struct {
	Genre   string
	Seconds int
}

type ProfileSummary struct {
	JourneyCount int
	TotalSeconds int
	RecentGames  []ProfileRecentGame
	GenreHours   []ProfileGenreHours
}

// GetProfileSummary returns aggregated profile data for the given user:
// journey count, total playtime, 5 most recently played distinct games,
// and hours per genre (full credit regardless of how many genres a game has).
func GetProfileSummary(ctx context.Context, pool *pgxpool.Pool, userID string) (ProfileSummary, error) {
	var s ProfileSummary

	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
		FROM journeys WHERE user_id = $1
	`, userID).Scan(&s.JourneyCount, &s.TotalSeconds); err != nil {
		return s, err
	}

	gameRows, err := pool.Query(ctx, `
		SELECT sub.igdb_id, sub.game_name, sub.cover_url, sub.release_year, sub.last_played, totals.seconds_played
		FROM (
			SELECT DISTINCT ON (j.igdb_id)
				j.igdb_id, g.name AS game_name, g.cover_url, g.release_year, j.played_at AS last_played
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			WHERE j.user_id = $1
			ORDER BY j.igdb_id, j.played_at DESC, j.created_at DESC
		) sub
		JOIN (
			SELECT igdb_id, SUM(duration_seconds) AS seconds_played
			FROM journeys
			WHERE user_id = $1
			GROUP BY igdb_id
		) totals ON totals.igdb_id = sub.igdb_id
		ORDER BY sub.last_played DESC
		LIMIT 5
	`, userID)
	if err != nil {
		return s, err
	}
	defer gameRows.Close()
	for gameRows.Next() {
		var g ProfileRecentGame
		if err := gameRows.Scan(&g.IGDBID, &g.Name, &g.CoverURL, &g.ReleaseYear, &g.LastPlayed, &g.SecondsPlayed); err != nil {
			return s, err
		}
		s.RecentGames = append(s.RecentGames, g)
	}
	if err := gameRows.Err(); err != nil {
		return s, err
	}

	genreRows, err := pool.Query(ctx, `
		SELECT genre, SUM(j.duration_seconds) AS total_seconds
		FROM journeys j
		JOIN igdb_games g ON g.igdb_id = j.igdb_id
		CROSS JOIN UNNEST(g.genres) AS genre
		WHERE j.user_id = $1
		GROUP BY genre
		ORDER BY total_seconds DESC
		LIMIT 8
	`, userID)
	if err != nil {
		return s, err
	}
	defer genreRows.Close()
	for genreRows.Next() {
		var gh ProfileGenreHours
		if err := genreRows.Scan(&gh.Genre, &gh.Seconds); err != nil {
			return s, err
		}
		s.GenreHours = append(s.GenreHours, gh)
	}
	return s, genreRows.Err()
}

// ProfileGame represents a single game in the user's full library.
type ProfileGame struct {
	IGDBID        int
	Name          string
	CoverURL      *string
	ReleaseYear   *int
	Genres        []string
	LastPlayed    time.Time
	SecondsPlayed int
}

func EncodeGameCursor(lastPlayed time.Time, igdbID int) string {
	return fmt.Sprintf("%s,%d", lastPlayed.Format("2006-01-02"), igdbID)
}

func splitGameCursor(cursor string) (time.Time, int, error) {
	parts := strings.Split(cursor, ",")
	if len(parts) != 2 {
		return time.Time{}, 0, fmt.Errorf("invalid game cursor: %q", cursor)
	}
	t, err := time.Parse("2006-01-02", parts[0])
	if err != nil {
		return time.Time{}, 0, err
	}
	id, err := strconv.Atoi(parts[1])
	if err != nil {
		return time.Time{}, 0, err
	}
	return t, id, nil
}

// GetPlayerGames returns a paginated, filtered list of all games played by a user.
func GetPlayerGames(ctx context.Context, pool *pgxpool.Pool, userID string, limit int, cursor string, q string, activeGenre string) ([]ProfileGame, error) {
	args := []any{userID, limit}
	
	whereClause := ""
	argIdx := 3
	
	if cursor != "" {
		lastPlayed, igdbID, err := splitGameCursor(cursor)
		if err != nil {
			return nil, err
		}
		args = append(args, lastPlayed, igdbID)
		whereClause += fmt.Sprintf(" AND (sub.last_played, sub.igdb_id) < ($%d, $%d)", argIdx, argIdx+1)
		argIdx += 2
	}
	
	if q != "" {
		args = append(args, "%"+q+"%")
		whereClause += fmt.Sprintf(" AND (sub.game_name ILIKE $%d OR EXISTS (SELECT 1 FROM unnest(sub.genres) g WHERE g ILIKE $%d))", argIdx, argIdx)
		argIdx++
	}
	
	if activeGenre != "" {
		args = append(args, activeGenre)
		whereClause += fmt.Sprintf(" AND $%d = ANY(sub.genres)", argIdx)
		argIdx++
	}

	query := `
		SELECT sub.igdb_id, sub.game_name, sub.cover_url, sub.release_year, sub.genres, sub.last_played, totals.seconds_played
		FROM (
			SELECT DISTINCT ON (j.igdb_id)
				j.igdb_id, g.name AS game_name, g.cover_url, g.release_year, g.genres, j.played_at AS last_played
			FROM journeys j
			JOIN igdb_games g ON g.igdb_id = j.igdb_id
			WHERE j.user_id = $1
			ORDER BY j.igdb_id, j.played_at DESC, j.created_at DESC
		) sub
		JOIN (
			SELECT igdb_id, SUM(duration_seconds) AS seconds_played
			FROM journeys
			WHERE user_id = $1
			GROUP BY igdb_id
		) totals ON totals.igdb_id = sub.igdb_id
		WHERE 1=1 ` + whereClause + `
		ORDER BY sub.last_played DESC, sub.igdb_id DESC
		LIMIT $2
	`

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query player games: %w", err)
	}
	defer rows.Close()

	var games []ProfileGame
	for rows.Next() {
		var g ProfileGame
		if err := rows.Scan(&g.IGDBID, &g.Name, &g.CoverURL, &g.ReleaseYear, &g.Genres, &g.LastPlayed, &g.SecondsPlayed); err != nil {
			return nil, fmt.Errorf("scan player game: %w", err)
		}
		games = append(games, g)
	}
	return games, rows.Err()
}
