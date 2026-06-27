# API

Yurnik API — endpoint reference. All routes are served from the same binary.

## Conventions

- **Base URL** — `https://api.yurnik.social` in production. The frontend reads `VITE_API_URL` at build time.
- **Path prefixes** — OAuth routes are under `/auth/*` with no further prefix. All other web-facing routes are under `/api/*`. Routes used only by the desktop agent are under `/api/v1/agent/*`.
- **Encoding** — JSON throughout. `Content-Type: application/json` on all request bodies, except avatar upload which is a raw image body.
- **Timestamps** — RFC 3339 UTC in all requests and responses (`"2026-05-23T14:30:00Z"`).
- **Durations** — integer seconds in requests and responses. Clients format for display (`11640` → `"3h 14m"`).
- **Player identity** — players are identified by their internal UUID. `handle` is the stable, URL-safe identifier used in player-facing routes (`/api/players/{handle}/...`). Display name, avatar, and color are display data, not stable identifiers.
- **Pagination** — cursor-based. Responses include `"next_cursor"` when a further page exists. Pass `cursor=<value>` to advance. `limit` defaults to 20, max 50.

## Authentication

### Web — cookie-based session

The web app never sees a bearer token. Login is a server-side OAuth flow that ends with an HttpOnly session cookie:

1. `GET /auth/init?redirect_uri=<uri>` — the server generates a PKCE code verifier and state, stores them server-side, sets a short-lived `auth_state` cookie (HttpOnly, `SameSite=Lax`, 10 minutes), and redirects (302) to Discord's authorization page with a `code_challenge`.
2. User approves on Discord.
3. Discord redirects back to `GET /auth/callback?code=<code>&state=<state>` — the server validates `state` against the `auth_state` cookie (CSRF check), exchanges `code` for an access token using the stored verifier, fetches the Discord identity, upserts the user row, and redirects (302) to `{FrontendURL}/auth/complete`.
4. `POST /auth/session` — called by the frontend once the redirect lands. The server reads the `auth_state` cookie, confirms the callback completed, issues a signed session JWT, clears `auth_state`, and sets `yurnik_session` (HttpOnly, `SameSite=Strict`, 7 days). Returns `{"user_id": "..."}`.
5. Every subsequent authenticated request relies on the browser sending the `yurnik_session` cookie automatically. There is no `Authorization` header for web requests.

Session JWTs last 7 days. If a request arrives carrying a token older than 24 hours, the server transparently issues a renewed `yurnik_session` cookie on the response — a long-lived browser session never needs to re-authenticate via Discord as long as it keeps making requests.

### Logout

```
POST /auth/logout
```

Clears the `yurnik_session` cookie. Returns `204 No Content`.

### Agent — bearer JWT

The desktop agent cannot rely on browser cookies, so it authenticates with a bearer token carrying the same session JWT format:

1. The user logs in on the web app as above and holds a `yurnik_session` cookie.
2. The web app calls `POST /api/v1/agent/token` (cookie-authenticated) to obtain a signed JWT.
3. The web app hands the token to the agent via the `yurnik://auth?token=...` custom URL scheme.
4. The agent sends `Authorization: Bearer <token>` on every `/api/v1/agent/*` request.
5. The agent periodically (every few days) calls `POST /api/v1/agent/heartbeat`. It returns `204` if the token is still fresh, or `200 {"token": "<new>"}` if the token is older than 24 hours and has been renewed — the agent stores the new token and uses it going forward.

`/api/v1/agent/*` routes are bearer-only and are never called by the web app.

## Rate Limiting

| Layer | Scope | Limit |
|---|---|---|
| Cloudflare | Per IP | 100 req / minute |
| API server | Global | Configurable via `RATE_LIMIT_RPS` |
| API server | Per user, journey/comment writes | 20s minimum interval, escalating cooldown up to 5min for repeat violations |
| IGDB proxy | Upstream calls | 4 req / second |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

## Error Responses

Most errors return a JSON body:

```json
{
  "error": "not_found",
  "message": "optional human-readable detail"
}
```

`message` is present on validation errors and absent on simple status-only errors.

| HTTP | `error` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed body, missing required field, or a value outside its allowed range |
| 400 | `disallowed_content` | Journey log or comment contains a URL |
| 400 | `duplicate_content` | Journey log or comment is identical to the author's immediately previous one |
| 400 | `order_mismatch` | Horizon reorder payload doesn't match the player's current Horizon entries |
| 400 | `invalid_target_type` | Report target type is not one of the accepted values |
| 400 | `invalid_reason` | Report reason is not one of the accepted values |
| 400 | `missing_target_id` | Report submitted without a `target_id` |
| 400 | `note_required_for_other` | Report reason is `other` but no note was provided |
| 400 | `note_too_long` | Report note exceeds 200 characters |
| 401 | `unauthorized` | Missing or invalid session cookie (web) or bearer token (agent) |
| 403 | `forbidden` | Authenticated but not an admin |
| 404 | `not_found` | Resource does not exist, or does not belong to the caller |
| 409 | `already_reported` | The authenticated user has already reported this target |
| 429 | `rate_limited` | Too many requests (global or IGDB rate limit) |
| 429 | `too_many_requests` | Per-user write velocity limit hit — see `Retry-After` header |
| 500 | `internal_error` | Server fault |

---

## Shared Types

### PlayerSummary

The minimal player representation, embedded in lists, comments, echoes, and journey entries.

```json
{
  "id": "01920f3a-...",
  "handle": "maria",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.example.com/...",
  "color": "#7c3aed"
}
```

`avatar_url` is omitted if the player has no avatar. `color` is a server-assigned accent hex used as an avatar fallback.

### Player

Returned for a single player's profile (`GET /api/players/{handle}`).

```json
{
  "id": "01920f3a-...",
  "handle": "maria",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.example.com/...",
  "bio": "Chasing bosses and logging every moment.",
  "color": "#7c3aed",
  "followers": 142,
  "following": 37,
  "is_following": false
}
```

`avatar_url` and `bio` are omitted if not set. `is_following` reflects the authenticated caller's relationship to this player, and is `false` for anonymous requests.

### Journey

```json
{
  "id": "01920f3a-...",
  "igdb_id": 119388,
  "game": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"],
  "release_year": 2022,
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z",
  "duration_seconds": 11640,
  "log": "Finally beat the final boss.",
  "played_at": "2026-05-23T13:00:00Z"
}
```

`cover_url`, `release_year`, and `log` are omitted if not set.

### JourneyDetail

`GET /api/journeys/{id}` returns a `Journey` with an embedded `player`:

```json
{
  "id": "01920f3a-...",
  "igdb_id": 119388,
  "game": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"],
  "release_year": 2022,
  "duration_seconds": 11640,
  "log": "Finally beat the final boss.",
  "played_at": "2026-05-23T13:00:00Z",
  "player": { PlayerSummary }
}
```

### PendingJourney

```json
{
  "id": "01920f3a-...",
  "status": "ended",
  "igdb_id": 119388,
  "game": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"],
  "exe_name": "eldenring.exe",
  "window_title": "ELDEN RING",
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z",
  "duration": "3h 14m"
}
```

`status` is `active` or `ended`. `igdb_id`, `game`, `cover_url`, `genres`, `exe_name`, and `window_title` are omitted if not yet known. `ended_at` and `duration` are omitted while `status` is `active`.

### Game

```json
{
  "id": "119388",
  "name": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"],
  "release_year": 2022,
  "category": 0
}
```

`id` is the IGDB ID as a string. `cover_url`, `release_year`, and `category` are omitted if not set.

### GameDetail

`GET /api/games/{igdb_id}` returns a `Game` with additional fields:

```json
{
  "id": "119388",
  "name": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"],
  "release_year": 2022,
  "category": 0,
  "summary": "...",
  "screenshots": ["https://..."],
  "platforms": ["PC", "PlayStation 5"],
  "developer": "FromSoftware",
  "publisher": "Bandai Namco",
  "trailer_id": "abc123",
  "store_links": { "steam": "https://..." },
  "aggregated_rating": 95.2,
  "rating": 88.4,
  "in_horizon": false
}
```

All fields except `id`, `name`, `genres`, `screenshots`, `platforms`, and `in_horizon` are omitted if not available. `in_horizon` reflects the authenticated caller and is `false` for anonymous requests.

---

## Profile & Players

### Get current player

```
GET /api/me
```

Requires authentication.

**Response**

```json
{
  "id": "01920f3a-...",
  "handle": "maria",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.example.com/...",
  "bio": "Chasing bosses and logging every moment.",
  "color": "#7c3aed",
  "has_custom_avatar": true,
  "has_custom_name": false
}
```

`avatar_url` and `bio` are omitted if not set. `has_custom_avatar` / `has_custom_name` indicate whether the value was set by the user or is still the Discord default.

### Update current player

```
PATCH /api/me
```

Requires authentication.

**Body** (all fields optional)

```json
{
  "bio": "Updated bio.",
  "display_name": "Maria"
}
```

**Response** — `204 No Content`

### Upload avatar

```
POST /api/me/avatar
```

Requires authentication. Request body is the raw image bytes — `Content-Type` must be `image/jpeg`, `image/png`, or `image/webp`, and the body must be at most 2 MB.

**Response** — `204 No Content`

### Delete avatar

```
DELETE /api/me/avatar
```

Requires authentication. Reverts to the player's Discord avatar.

**Response** — `204 No Content`

### Get player by handle

```
GET /api/players/{handle}
```

**Response** — `Player`

### Get player profile summary

```
GET /api/me/profile
GET /api/players/{handle}/profile
```

`/api/me/profile` requires authentication and returns the caller's own summary. `/api/players/{handle}/profile` is public.

**Response**

```json
{
  "id": "01920f3a-...",
  "handle": "maria",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.example.com/...",
  "bio": "Chasing bosses and logging every moment.",
  "color": "#7c3aed",
  "followers": 142,
  "following": 37,
  "is_following": false,
  "journey_count": 58,
  "total_seconds": 412000,
  "recent_games": [
    {
      "igdb_id": 119388,
      "name": "Elden Ring",
      "cover_url": "https://images.igdb.com/...",
      "release_year": 2022,
      "last_played": "2026-05-23T13:00:00Z"
    }
  ],
  "genre_hours": [
    { "genre": "RPG", "seconds": 180000 }
  ],
  "horizon": [
    {
      "igdb_id": 119388,
      "name": "Elden Ring",
      "cover_url": "https://images.igdb.com/...",
      "genres": ["RPG", "Action"],
      "release_year": 2022
    }
  ]
}
```

`recent_games` is the five most recently played distinct games, ordered by most recent first. `genre_hours` is the top eight genres by total seconds played. `horizon` is the player's full Horizon list, in display order. See [DESIGN.md](DESIGN.md#player-profile) for the reasoning behind these fields.

### Get player activity

```
GET /api/players/{handle}/activity
```

A merged, paginated feed of the player's own journeys and activity they triggered (follows, comments, Horizon additions). Same item shape as [Feed](#feed).

**Response** — see [Feed](#feed)

### Follow a player

```
POST /api/players/{handle}/follow
```

Requires authentication. Returns `400 invalid_request` if `handle` resolves to the caller.

**Response** — `204 No Content`

### Unfollow a player

```
DELETE /api/players/{handle}/follow
```

Requires authentication.

**Response** — `204 No Content`

### List followers / following

```
GET /api/players/{handle}/followers
GET /api/players/{handle}/following
```

**Response**

```json
{
  "players": [ PlayerSummary ]
}
```

---

## Feed

```
GET /api/feed
```

Requires authentication. A reverse-chronological, merged feed of confirmed journeys and activity events (new comments, new followers, Horizon additions) from players the caller follows. This is the Realm — see [DESIGN.md](DESIGN.md#realm-feed).

**Response**

```json
{
  "items": [
    {
      "kind": "journey",
      "journey": {
        "id": "01920f3a-...",
        "igdb_id": 119388,
        "game": "Elden Ring",
        "cover_url": "https://images.igdb.com/...",
        "genres": ["RPG", "Action"],
        "release_year": 2022,
        "duration_seconds": 11640,
        "log": "Finally beat the final boss.",
        "played_at": "2026-05-23T13:00:00Z",
        "player": { PlayerSummary }
      }
    },
    {
      "kind": "activity",
      "activity": {
        "type": "follow",
        "created_at": "2026-05-24T09:00:00Z",
        "actor": { PlayerSummary },
        "recipient": { PlayerSummary },
        "subject_id": "01920f3b-...",
        "subject_title": "Elden Ring",
        "subject_igdb_id": 119388
      }
    }
  ],
  "next_cursor": "..."
}
```

`kind` is `journey` or `activity`; exactly one of `journey` / `activity` is present per item. `activity.type` is `follow`, `comment`, or `horizon_add`. `subject_id`, `subject_title`, and `subject_igdb_id` are present for `comment` and `horizon_add` activity and omitted for `follow`.

---

## Journeys

### Get journey

```
GET /api/journeys/{id}
```

**Response** — `JourneyDetail`

### List players on a journey

```
GET /api/journeys/{id}/players
```

Other players who have logged a journey for the same game — "Following on this journey" and "Others on this journey" in the journey detail view (see [DESIGN.md](DESIGN.md#journey-detail)).

**Response**

```json
{
  "players": [
    {
      "journey_id": "01920f3c-...",
      "player": {
        "id": "01920f3a-...",
        "handle": "maria",
        "name": "Maria Chen",
        "avatar_url": "https://cdn.example.com/...",
        "color": "#7c3aed",
        "is_following": true
      },
      "duration_seconds": 9000,
      "played_at": "2026-05-20T13:00:00Z"
    }
  ]
}
```

`is_following` reflects the authenticated caller and is `false` for anonymous requests.

### List own journeys

```
GET /api/players/me/journeys
```

Requires authentication. Reverse chronological by `played_at`.

**Response**

```json
{
  "journeys": [ Journey ],
  "next_cursor": "..."
}
```

### List journeys by player

```
GET /api/players/{handle}/journeys
```

Same response shape as [List own journeys](#list-own-journeys).

### Log a journey manually

```
POST /api/players/me/journeys
```

Requires authentication. Creates a confirmed journey directly. No pending step.

**Body**

```json
{
  "igdb_id": 119388,
  "duration_seconds": 11640,
  "played_at": "2026-05-23T13:00:00Z",
  "log": "Finally beat the final boss."
}
```

`igdb_id`, `duration_seconds` (minimum 60), and `played_at` are required. `log` is optional, plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous journey log. Violations return `invalid_request`, `disallowed_content`, or `duplicate_content` respectively (see [Error Responses](#error-responses)). This endpoint is also subject to the per-user write velocity limit.

**Response** — `201 Created`

```json
{ "id": "01920f3a-..." }
```

### Update a journey

```
PATCH /api/players/me/journeys/{id}
```

Requires authentication. Edits a confirmed journey owned by the caller.

**Body**

```json
{
  "igdb_id": 119388,
  "duration_seconds": 11640,
  "played_at": "2026-05-23T13:00:00Z",
  "log": "Finally beat the final boss."
}
```

`igdb_id`, `duration_seconds` (minimum 60), and `played_at` are required. `log` is optional, plain text up to 400 characters, and must not contain a URL — `disallowed_content` on violation. Unlike creation, the duplicate-content check does **not** apply here: editing a journey without changing the log must not be flagged as a duplicate of itself. This endpoint is also subject to the per-user write velocity limit.

**Response** — `204 No Content`

### Delete a journey

```
DELETE /api/players/me/journeys/{id}
```

Requires authentication.

**Response** — `204 No Content`

---

## Pending Journeys

Pending journeys are created by the agent when a game is detected. They are private and never visible to other players until confirmed.

### List pending journeys

```
GET /api/players/me/journeys/pending
```

Requires authentication. Returns the authenticated user's pending journeys with status `active` or `ended`.

**Response**

```json
{
  "journeys": [ PendingJourney ]
}
```

### Confirm a pending journey

```
POST /api/players/me/journeys/pending/{id}/confirm
```

Requires authentication. Writes a confirmed journey and deletes the pending row.

**Body**

```json
{
  "igdb_id": 119388,
  "duration_seconds": 11640,
  "played_at": "2026-05-23T13:00:00Z",
  "log": "Finally beat the final boss."
}
```

`igdb_id` is required — the user must confirm or correct the game match. `duration_seconds` and `played_at` are optional and default to values derived from the pending journey's recorded start/end times. `log` is optional, plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous journey log. This endpoint is also subject to the per-user write velocity limit.

**Response**

```json
{ "id": "01920f3a-..." }
```

### Discard a pending journey

```
POST /api/players/me/journeys/pending/{id}/discard
```

Requires authentication. Deletes the pending row with no further action.

**Response** — `204 No Content`

### Exclude an executable

```
POST /api/players/me/journeys/pending/{id}/exclude
```

Requires authentication. Adds the pending journey's executable to the user's exclusion list and discards the journey. Returns `400 invalid_request` if the pending journey has no associated executable. Future detections of this executable are silently ignored by the agent.

**Response** — `204 No Content`

---

## Comments

### List comments for a journey

```
GET /api/journeys/{id}/comments
```

Flat, chronological order.

**Response**

```json
{
  "comments": [
    {
      "id": "01920f3a-...",
      "player": { PlayerSummary },
      "text": "Great run!",
      "commented_at": "2026-05-23T17:00:00Z"
    }
  ]
}
```

### Post a comment

```
POST /api/journeys/{id}/comments
```

Requires authentication.

**Body**

```json
{
  "text": "Great run!"
}
```

`text` is plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous comment. This endpoint is also subject to the per-user write velocity limit.

**Response** — `201 Created`

```json
{
  "id": "01920f3a-...",
  "player": { PlayerSummary },
  "text": "Great run!",
  "commented_at": "2026-05-23T17:00:00Z"
}
```

### Delete a comment

```
DELETE /api/journeys/{id}/comments/{commentId}
```

Requires authentication. Only the comment author can delete their own comments.

**Response** — `204 No Content`

---

## Echoes

Echoes are in-app notifications, batched — one echo per `(type, subject)` accumulates actors over time rather than producing one notification per actor. See [DESIGN.md](DESIGN.md#echoes).

### List echoes

```
GET /api/echoes
```

Requires authentication. Reverse chronological by `updated_at`.

**Response**

```json
{
  "echoes": [
    {
      "id": 12345,
      "type": "new_comment",
      "actors": [ PlayerSummary, PlayerSummary ],
      "actor_count": 5,
      "subject_id": "01920f3b-...",
      "subject_title": "Elden Ring",
      "read": false,
      "created_at": "2026-05-23T17:00:00Z",
      "updated_at": "2026-05-24T09:00:00Z"
    },
    {
      "id": 12346,
      "type": "new_follower",
      "actors": [ PlayerSummary ],
      "actor_count": 1,
      "subject_id": null,
      "subject_title": null,
      "read": true,
      "created_at": "2026-05-22T10:00:00Z",
      "updated_at": "2026-05-22T10:00:00Z"
    }
  ],
  "unread_count": 1
}
```

`type` is `new_comment` or `new_follower`. `subject_id` and `subject_title` are `null` for `new_follower` echoes. `actors` contains at most 3 players — `actor_count` gives the full total. `subject_title` is snapshotted at creation and remains even if the journey is later deleted. `read` is `false` until the notification panel has been opened.

### Mark all echoes as read

```
POST /api/echoes/read
```

Requires authentication. Called when the notification panel opens. Marks all unread echoes for the authenticated user as read in one operation.

**Response** — `204 No Content`

---

## Horizon

A player's public list of games they intend to play in the future. See [DESIGN.md](DESIGN.md#terminology).

### List a player's Horizon

```
GET /api/players/{handle}/horizon
```

**Response**

```json
{
  "entries": [
    {
      "igdb_id": 119388,
      "name": "Elden Ring",
      "cover_url": "https://images.igdb.com/...",
      "genres": ["RPG", "Action"],
      "release_year": 2022,
      "added_at": "2026-05-01T10:00:00Z"
    }
  ]
}
```

### Add to own Horizon

```
POST /api/me/horizon
```

Requires authentication.

**Body**

```json
{ "igdb_id": 119388 }
```

**Response** — `204 No Content`

### Remove from own Horizon

```
DELETE /api/me/horizon/{igdb_id}
```

Requires authentication.

**Response** — `204 No Content`

### Reorder own Horizon

```
PATCH /api/me/horizon/order
```

Requires authentication.

**Body**

```json
{ "igdb_ids": [119388, 1942, 1020] }
```

Must contain exactly the IGDB IDs currently in the caller's Horizon, in the desired display order. Returns `400 order_mismatch` if the set doesn't match.

**Response** — `204 No Content`

---

## Settings

### Exclusions

Executables the agent will never create a pending journey for.

#### List exclusions

```
GET /api/settings/exclusions
```

Requires authentication.

**Response**

```json
{
  "exclusions": [
    { "exe_name": "launcher.exe" }
  ]
}
```

#### Add an exclusion

```
POST /api/settings/exclusions
```

Requires authentication.

**Body**

```json
{ "exe_name": "launcher.exe" }
```

**Response** — `204 No Content`

#### Delete an exclusion

```
DELETE /api/settings/exclusions/{exeName}
```

Requires authentication.

**Response** — `204 No Content`

### Hints

`exe_name → igdb_id` mappings, built from confirmed corrections, used to accelerate repeat detections.

#### List hints

```
GET /api/settings/hints
```

Requires authentication.

**Response**

```json
{
  "hints": [
    { "exe_name": "eldenring.exe", "igdb_id": 119388, "title": "Elden Ring" }
  ]
}
```

#### Upsert a hint

```
PUT /api/settings/hints/{exeName}
```

Requires authentication.

**Body**

```json
{ "igdb_id": 119388 }
```

**Response** — `204 No Content`

#### Delete a hint

```
DELETE /api/settings/hints/{exeName}
```

Requires authentication.

**Response** — `204 No Content`

---

## Games

### Search games

```
GET /api/games/search?q=<query>
```

IGDB-backed game search. Results are cached server-side.

**Response**

```json
[ Game ]
```

### Get game

```
GET /api/games/{igdb_id}
```

**Response** — `GameDetail`

### List journeys for a game

```
GET /api/games/{igdb_id}/journeys
```

Recent journeys logged for this game, across all players — backs the Players page (see [DESIGN.md](DESIGN.md#players-page)).

**Response**

```json
{
  "players": [
    {
      "journey_id": "01920f3a-...",
      "player": {
        "id": "01920f3a-...",
        "handle": "maria",
        "name": "Maria Chen",
        "avatar_url": "https://cdn.example.com/...",
        "color": "#7c3aed",
        "is_following": true,
        "is_self": false
      },
      "duration_seconds": 11640,
      "played_at": "2026-05-23T13:00:00Z"
    }
  ]
}
```

`is_following` and `is_self` reflect the authenticated caller and are `false` for anonymous requests.

### Global activity feed

```
GET /api/activity
```

Recent journeys across all players, grouped by game — backs game discovery.

**Response**

```json
{
  "games": [
    {
      "id": "119388",
      "game": "Elden Ring",
      "cover_url": "https://images.igdb.com/...",
      "genres": ["RPG", "Action"],
      "release_year": 2022,
      "entries": [
        {
          "session_id": "01920f3a-...",
          "player": { PlayerSummary },
          "duration_seconds": 11640,
          "played_at": "2026-05-23T13:00:00Z",
          "log": "Finally beat the final boss."
        }
      ]
    }
  ]
}
```

`log` is omitted if the journey has none.

---

## Reports

Any authenticated user can file a report on a journey log, a comment, or a profile. Reports are reviewed by admins — see [DESIGN.md](DESIGN.md#moderation).

### Submit a report

```
POST /api/reports
```

Requires authentication. Subject to the per-user report velocity limit (20-minute minimum interval, escalating up to 24 hours).

**Body**

```json
{
  "target_type": "journey_log",
  "target_id": "01920f3a-...",
  "context_id": "01920f3b-...",
  "reason": "spam",
  "note": "Optional detail."
}
```

`target_type` is one of `journey_log`, `comment`, `profile`. `target_id` is the UUID of the reported resource. `context_id` is the journey UUID when `target_type` is `comment`, otherwise omitted. `reason` is one of `spam`, `harassment`, `hate_speech`, `explicit`, `impersonation`, `private_info`, `other`. `note` is optional plain text (max 200 characters), required when `reason` is `other`.

Returns `409 already_reported` if the caller has already reported this target.

**Response** — `204 No Content`

---

## Admin

Admin routes require the authenticated user to have `is_admin = true`. All routes return `401 unauthorized` if not authenticated and `403 forbidden` if authenticated but not an admin. See [DESIGN.md](DESIGN.md#moderation) for the moderation model.

### List reports

```
GET /api/admin/reports
```

Returns all reports, newest first.

**Response**

```json
{
  "reports": [
    {
      "id": "01920f3a-...",
      "reporter_handle": "maria",
      "reporter_name": "Maria Chen",
      "reporter_avatar": "https://cdn.example.com/...",
      "reporter_color": "#7c3aed",
      "target_type": "comment",
      "target_id": "01920f3b-...",
      "context_id": "01920f3c-...",
      "target_handle": null,
      "reason": "spam",
      "note": null,
      "created_at": "2026-06-18T10:00:00Z"
    }
  ]
}
```

`reporter_avatar` and `note` are omitted if not set. `context_id` is present for `comment` reports. `target_handle` is set for `profile` reports (the reported user's handle) and `null` otherwise.

### Suspend a user

```
POST /api/admin/users/{id}/suspend
```

Sets `suspended_at` on the user. Suspended users cannot authenticate.

**Response** — `204 No Content`

### Unsuspend a user

```
DELETE /api/admin/users/{id}/suspend
```

Clears `suspended_at`.

**Response** — `204 No Content`

### List suspended users

```
GET /api/admin/users/suspended
```

**Response**

```json
{
  "users": [
    {
      "id": "01920f3a-...",
      "handle": "maria",
      "name": "Maria Chen",
      "avatar_url": "https://cdn.example.com/...",
      "color": "#7c3aed",
      "suspended_at": "2026-06-18T10:00:00Z"
    }
  ]
}
```

`avatar_url` is omitted if not set.

### Reset a user's profile

```
POST /api/admin/users/{id}/reset-profile
```

Clears `custom_avatar_url` and `display_name`, reverting the user's avatar and display name to their Discord values.

**Response** — `204 No Content`

### Clear a journey log

```
DELETE /api/admin/journeys/{id}/log
```

Sets `log = NULL` on the journey row. The journey itself is preserved.

**Response** — `204 No Content`

### Delete a comment (admin)

```
DELETE /api/admin/comments/{id}
```

Deletes the comment regardless of who authored it.

**Response** — `204 No Content`

---

## Agent routes

These routes are called only by the desktop agent, using `Authorization: Bearer <token>` (see [Authentication](#agent--bearer-jwt)).

### Get an agent token

```
POST /api/v1/agent/token
```

Cookie-authenticated (`yurnik_session`) — called by the web app, not the agent directly. Issues a bearer JWT for the agent.

**Response**

```json
{ "token": "eyJ..." }
```

### Heartbeat

```
POST /api/v1/agent/heartbeat
```

Called periodically (every few days) by the agent to keep its session alive.

**Response** — `204 No Content` if the token is still fresh, or `200` with a renewed token if it is older than 24 hours:

```json
{ "token": "eyJ..." }
```

### Create a pending journey

```
POST /api/v1/agent/pending-journeys
```

Called by the agent when a game is detected.

**Body**

```json
{
  "exe_name": "eldenring.exe",
  "window_title": "ELDEN RING",
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z"
}
```

`exe_name` is required. `window_title`, `started_at`, and `ended_at` are optional. If `exe_name` is on the caller's exclusion list, the pending journey is silently dropped and `204 No Content` is returned with no `id`. If a stored hint matches `exe_name`, the pending journey is created with that `igdb_id` pre-filled.

**Response**

```json
{ "id": "01920f3a-..." }
```
