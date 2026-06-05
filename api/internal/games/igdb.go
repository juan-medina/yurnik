// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
package games

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Game is a game record returned by IGDB search.
type Game struct {
	IGDBID      int
	Name        string
	CoverURL    string
	Genres      []string
	ReleaseYear *int
	Category    *int
}

// Client calls the IGDB API using Twitch client credentials.
// The Twitch access token is cached in memory and refreshed transparently.
// All outbound IGDB calls are gated to 4 req/s by the embedded rate limiter.
type Client struct {
	clientID     string
	clientSecret string
	limiter      *rate.Limiter

	mu          sync.Mutex
	token       string
	tokenExpiry time.Time
}

func NewClient(clientID, clientSecret string) *Client {
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		limiter:      rate.NewLimiter(4, 4),
	}
}

func (c *Client) refreshToken(ctx context.Context) error {
	resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", url.Values{
		"client_id":     {c.clientID},
		"client_secret": {c.clientSecret},
		"grant_type":    {"client_credentials"},
	})
	if err != nil {
		return fmt.Errorf("fetch twitch token: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("fetch twitch token %d: %s", resp.StatusCode, b)
	}
	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode twitch token: %w", err)
	}
	c.token = result.AccessToken
	// Subtract 5 minutes so we refresh before the token actually expires.
	c.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn)*time.Second - 5*time.Minute)
	return nil
}

func (c *Client) getToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		return c.token, nil
	}
	if err := c.refreshToken(ctx); err != nil {
		return "", err
	}
	return c.token, nil
}

type igdbGame struct {
	ID                int    `json:"id"`
	Name              string `json:"name"`
	Cover             *struct {
		ImageID string `json:"image_id"`
	} `json:"cover"`
	Genres []struct {
		Name string `json:"name"`
	} `json:"genres"`
	FirstReleaseDate *int64 `json:"first_release_date"`
	Category         *int   `json:"game_type"`
}

// Search queries IGDB for games matching query. It blocks until the rate
// limiter allows the call. Results are not cached here — the caller is
// responsible for persisting them.
func (c *Client) Search(ctx context.Context, query string, offset int) ([]Game, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("igdb rate limit: %w", err)
	}

	tok, err := c.getToken(ctx)
	if err != nil {
		return nil, err
	}

	escaped := strings.ReplaceAll(query, `"`, `\"`)
	body := fmt.Sprintf(`search "%s"; fields name,cover.image_id,genres.name,first_release_date,game_type; limit 10; offset %d;`, escaped, offset)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.igdb.com/v4/games", strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build igdb request: %w", err)
	}
	req.Header.Set("Client-ID", c.clientID)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "text/plain")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("igdb search: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("igdb search %d: %s", resp.StatusCode, b)
	}

	var raw []igdbGame
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode igdb response: %w", err)
	}

	games := make([]Game, 0, len(raw))
	for _, g := range raw {
		game := Game{IGDBID: g.ID, Name: g.Name, Category: g.Category}
		if g.Cover != nil {
			game.CoverURL = "https://images.igdb.com/igdb/image/upload/t_cover_big/" + g.Cover.ImageID + ".jpg"
		}
		for _, genre := range g.Genres {
			game.Genres = append(game.Genres, genre.Name)
		}
		// IGDB does not guarantee genres — coerce nil to empty slice so the
		// NOT NULL constraint on igdb_games.genres is never violated.
		if game.Genres == nil {
			game.Genres = []string{}
		}
		if g.FirstReleaseDate != nil {
			y := time.Unix(*g.FirstReleaseDate, 0).UTC().Year()
			game.ReleaseYear = &y
		}
		games = append(games, game)
	}

	return games, nil
}
