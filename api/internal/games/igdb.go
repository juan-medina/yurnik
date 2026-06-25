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
	ReleaseDate *time.Time
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

// GameDetails holds the on-demand fields fetched for a single game page.
type GameDetails struct {
	IGDBID           int
	Slug             string
	Summary          *string
	Screenshots      []string
	Platforms        []string
	Developer        *string
	Publisher        *string
	TrailerID        *string
	StoreLinks       map[string]string // key: "steam"|"epic"|"playstation"|"xbox"|"gog", value: URL
	AggregatedRating *float64          // external critics, 0–100
	Rating           *float64          // IGDB community, 0–100
	ReleaseYear      *int
	ReleaseDate      *time.Time
}

// GetDetails fetches the full detail record for a single IGDB game ID.
func (c *Client) GetDetails(ctx context.Context, igdbID int) (GameDetails, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return GameDetails{}, fmt.Errorf("igdb rate limit: %w", err)
	}

	tok, err := c.getToken(ctx)
	if err != nil {
		return GameDetails{}, err
	}

	gameBody := fmt.Sprintf(
		`fields slug,summary,screenshots.image_id,platforms.name,`+
			`involved_companies.company.name,involved_companies.developer,involved_companies.publisher,`+
			`videos.video_id,aggregated_rating,rating,first_release_date;`+
			` where id = %d;`,
		igdbID,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.igdb.com/v4/games", strings.NewReader(gameBody))
	if err != nil {
		return GameDetails{}, fmt.Errorf("build igdb details request: %w", err)
	}
	req.Header.Set("Client-ID", c.clientID)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "text/plain")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return GameDetails{}, fmt.Errorf("igdb details: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return GameDetails{}, fmt.Errorf("igdb details %d: %s", resp.StatusCode, b)
	}

	rawBody, _ := io.ReadAll(resp.Body)
	var raw []struct {
		ID      int     `json:"id"`
		Slug    string  `json:"slug"`
		Summary *string `json:"summary"`
		Screenshots []struct {
			ImageID string `json:"image_id"`
		} `json:"screenshots"`
		Platforms []struct {
			Name string `json:"name"`
		} `json:"platforms"`
		InvolvedCompanies []struct {
			Company   struct{ Name string `json:"name"` } `json:"company"`
			Developer bool `json:"developer"`
			Publisher bool `json:"publisher"`
		} `json:"involved_companies"`
		Videos []struct {
			VideoID string `json:"video_id"`
		} `json:"videos"`
		AggregatedRating *float64 `json:"aggregated_rating"`
		Rating           *float64 `json:"rating"`
		FirstReleaseDate *int64   `json:"first_release_date"`
	}
	if err := json.Unmarshal(rawBody, &raw); err != nil {
		return GameDetails{}, fmt.Errorf("decode igdb details: %w", err)
	}
	if len(raw) == 0 {
		return GameDetails{}, fmt.Errorf("igdb details: game %d not found", igdbID)
	}

	g := raw[0]
	d := GameDetails{IGDBID: igdbID, Slug: g.Slug, Summary: g.Summary}

	for _, s := range g.Screenshots {
		d.Screenshots = append(d.Screenshots,
			"https://images.igdb.com/igdb/image/upload/t_screenshot_big/"+s.ImageID+".jpg")
	}
	for _, p := range g.Platforms {
		d.Platforms = append(d.Platforms, p.Name)
	}
	for _, ic := range g.InvolvedCompanies {
		name := ic.Company.Name
		if ic.Developer && d.Developer == nil {
			d.Developer = &name
		}
		if ic.Publisher && d.Publisher == nil {
			d.Publisher = &name
		}
	}
	if len(g.Videos) > 0 {
		d.TrailerID = &g.Videos[0].VideoID
	}
	d.AggregatedRating = g.AggregatedRating
	d.Rating = g.Rating
	if g.FirstReleaseDate != nil {
		t := time.Unix(*g.FirstReleaseDate, 0).UTC()
		y := t.Year()
		d.ReleaseYear = &y
		d.ReleaseDate = &t
	}

	d.StoreLinks = c.fetchStoreLinks(ctx, tok, igdbID)

	return d, nil
}

// fetchStoreLinks queries /v4/websites for all URLs associated with the game,
// then classifies store links by URL pattern. IGDB does not reliably return the
// category field on website objects, so pattern matching on the URL is the only
// robust approach.
func (c *Client) fetchStoreLinks(ctx context.Context, tok string, igdbID int) map[string]string {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil
	}

	body := fmt.Sprintf(`fields url; where game = %d; limit 30;`, igdbID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.igdb.com/v4/websites", strings.NewReader(body))
	if err != nil {
		return nil
	}
	req.Header.Set("Client-ID", c.clientID)
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "text/plain")

	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return nil
	}
	defer resp.Body.Close()

	var websites []struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&websites); err != nil {
		return nil
	}

	links := map[string]string{}
	for _, w := range websites {
		u := strings.ToLower(w.URL)
		switch {
		case strings.Contains(u, "store.steampowered.com"):
			links["steam"] = w.URL
		case strings.Contains(u, "store.epicgames.com"):
			links["epic"] = w.URL
		case strings.Contains(u, "store.playstation.com"):
			links["playstation"] = w.URL
		case strings.Contains(u, "xbox.com") && (strings.Contains(u, "/games/") || strings.Contains(u, "/store/")):
			links["xbox"] = w.URL
		case strings.Contains(u, "gog.com") && strings.Contains(u, "/game"):
			links["gog"] = w.URL
		case strings.Contains(u, "nintendo.com") && strings.Contains(u, "/software/"):
			links["nintendo"] = w.URL
		}
	}
	if len(links) == 0 {
		return nil
	}
	return links
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
			t := time.Unix(*g.FirstReleaseDate, 0).UTC()
			y := t.Year()
			game.ReleaseYear = &y
			game.ReleaseDate = &t
		}
		games = append(games, game)
	}

	return games, nil
}
