# API

Yurnik API — endpoint reference. All routes are served from the same binary. Prefix every path with `/api/v1`.

## Conventions

- **Base URL** — `https://api.yurnik.social/api/v1` in production. The frontend reads `VITE_API_URL` at build time.
- **Encoding** — JSON throughout. `Content-Type: application/json` on all request bodies.
- **Timestamps** — RFC 3339 UTC in all requests and responses (`"2026-05-23T14:30:00Z"`).
- **Durations** — integer seconds in requests and responses. Clients format for display (`11640` → `"3h 14m"`).
- **Player identity** — players are identified by their internal UUID. Display names and avatars are sourced from the player's profile and treated as display data, not stable identifiers.
- **Pagination** — cursor-based. Responses include `"next_cursor"` when a further page exists. Pass `cursor=<value>` to advance. `limit` defaults to 20, max 50.

## Authentication

Login is via OAuth. The web app flow:

1. `GET /auth/init?redirect_uri=<uri>` — server redirects the browser to the provider's authorization page.
2. User approves on the provider.
3. Provider redirects back with `?code=…&state=…`.
4. `GET /auth/callback?code=…&state=…` — server exchanges the code, upserts the user, issues a session token.
5. `POST /auth/session` — client exchanges the completed state for a bearer token.

The agent receives its token via the `yurnik://auth?token=…` custom URL scheme after the user logs in on the web app.

All authenticated endpoints require:

```
Authorization: Bearer <session_token>
```

### Logout

```
POST /auth/logout
```

Invalidates the current session token. Returns `204 No Content`.

## Rate Limiting

| Layer | Scope | Limit |
|---|---|---|
| Cloudflare | Per IP | 100 req / minute |
| API server | Global | Configurable via `RATE_LIMIT_RPS` |
| API server | Per user, journey/comment writes | 20s minimum interval, escalating cooldown up to 5min for repeat violations |
| IGDB proxy | Upstream calls | 4 req / second |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

## Error Responses

All errors return a JSON body:

```json
{
  "error": "journey_not_found",
  "message": "Journey 'abc' does not exist or does not belong to you."
}
```

| HTTP | `error` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed body or missing required field |
| 401 | `unauthorized` | Missing or invalid bearer token |
| 403 | `forbidden` | Token valid, action not permitted |
| 404 | `not_found` | Resource does not exist |
| 400 | `duplicate_content` | Journey log or comment is identical to the author's immediately previous one |
| 400 | `disallowed_content` | Journey log or comment contains a URL |
| 409 | `conflict` | Resource already exists (duplicate like, duplicate exclusion) |
| 429 | `rate_limited` | Too many requests (global or IGDB rate limit) |
| 429 | `too_many_requests` | Per-user write velocity limit hit — see `Retry-After` header |
| 500 | `internal_error` | Server fault |

---

## Shared Types

### Player

```json
{
  "id": "01920f3a-...",
  "handle": "maria",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.example.com/...",
  "bio": "Chasing bosses and logging every moment.",
  "follower_count": 142,
  "following_count": 37,
  "color": "#7c3aed"
}
```

`avatar_url` and `bio` are optional. `color` is a server-assigned accent hex used as an avatar fallback.

### Journey

```json
{
  "id": "01920f3a-...",
  "player": { Player },
  "game": { Game },
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z",
  "duration_seconds": 11640,
  "log": "Finally beat the final boss.",
  "comment_count": 4,
  "played_at": "2026-05-23T13:00:00Z",
  "created_at": "2026-05-23T16:20:00Z"
}
```

`log` is optional.

### Pending Journey

```json
{
  "id": "01920f3a-...",
  "status": "ended",
  "game": { Game },
  "exe_name": "eldenring.exe",
  "window_title": "ELDEN RING",
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z",
  "duration_seconds": 11640
}
```

`status` is `active` or `ended`. `game`, `exe_name`, `window_title`, and `ended_at` are optional — a pending journey may not have a confirmed game match yet.

### Game

```json
{
  "igdb_id": 119388,
  "name": "Elden Ring",
  "cover_url": "https://images.igdb.com/...",
  "genres": ["RPG", "Action"]
}
```

---

## Auth

### Initiate login

```
GET /auth/init?redirect_uri=<uri>
```

Redirects the browser to the provider's OAuth authorization page. `redirect_uri` is where the provider will send the user after approval.

### OAuth callback

```
GET /auth/callback?code=<code>&state=<state>
```

Handled server-side. Exchanges the authorization code, upserts the user row, and redirects to the frontend.

### Exchange session token

```
POST /auth/session
```

Called by the frontend after the OAuth callback completes. Returns a bearer token.

**Response**

```json
{
  "token": "eyJ...",
  "player": { Player }
}
```

---

## Players

### Get current player

```
GET /players/me
```

Returns the authenticated player's profile.

**Response** — `Player`

### Get player by ID

```
GET /players/:id
```

**Response** — `Player`

### Update current player profile

```
PATCH /players/me
```

**Body**

```json
{
  "bio": "Updated bio."
}
```

**Response** — `Player`

### Follow a player

```
POST /players/:id/follow
```

**Response** — `204 No Content`

### Unfollow a player

```
DELETE /players/:id/follow
```

**Response** — `204 No Content`

### List followers

```
GET /players/:id/followers
```

**Response**

```json
{
  "players": [ Player ],
  "next_cursor": "..."
}
```

### List following

```
GET /players/:id/following
```

**Response**

```json
{
  "players": [ Player ],
  "next_cursor": "..."
}
```

---

## Journeys

### List Realm feed

```
GET /journeys/realm
```

Confirmed journeys from players the authenticated user follows, reverse chronological.

**Response**

```json
{
  "journeys": [ Journey ],
  "next_cursor": "..."
}
```

### List journeys by player

```
GET /players/:id/journeys
```

**Response**

```json
{
  "journeys": [ Journey ],
  "next_cursor": "..."
}
```

### Get journey

```
GET /journeys/:id
```

**Response** — `Journey`

### Log a journey manually

```
POST /players/me/journeys
```

Creates a confirmed journey directly. No pending step.

**Body**

```json
{
  "igdb_id": 119388,
  "started_at": "2026-05-23T13:00:00Z",
  "ended_at": "2026-05-23T16:14:00Z",
  "log": "Finally beat the final boss."
}
```

`log` is optional, plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous journey log. Violations return `invalid_request`, `disallowed_content`, or `duplicate_content` respectively (see [Error Responses](#error-responses)). Writes are also subject to the per-user write velocity limit.

**Response** — `Journey`

### Delete a journey

```
DELETE /players/me/journeys/:id
```

**Response** — `204 No Content`

---

## Pending Journeys

Pending journeys are created by the agent when a game is detected. They are private and never visible to other players until confirmed.

### List pending journeys

```
GET /players/me/journeys/pending
```

Returns the authenticated user's pending journeys with status `active` or `ended`, reverse chronological.

**Response**

```json
{
  "journeys": [ PendingJourney ]
}
```

### Confirm a pending journey

```
POST /players/me/journeys/pending/:id/confirm
```

User confirms the journey. Writes the confirmed journey row and deletes the pending row.

**Body**

```json
{
  "igdb_id": 119388,
  "log": "Finally beat the final boss."
}
```

`log` is optional, plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous journey log. `igdb_id` is required — the user must confirm or correct the game match. Writes are also subject to the per-user write velocity limit.

**Response** — `Journey`

### Discard a pending journey

```
POST /players/me/journeys/pending/:id/discard
```

User discards the journey. Deletes the pending row with no further action.

**Response** — `204 No Content`

### Exclude an executable

```
POST /players/me/journeys/pending/:id/exclude
```

Adds the pending journey's executable to the user's exclusion list and discards the journey. Future detections of this executable are silently ignored.

**Response** — `204 No Content`

### Agent routes

These routes are called by the desktop agent, not the web app.

#### Create a pending journey

```
POST /pending-journeys
```

Called by the agent when a game is detected.

**Body**

```json
{
  "igdb_id": 119388,
  "exe_name": "eldenring.exe",
  "window_title": "ELDEN RING",
  "started_at": "2026-05-23T13:00:00Z"
}
```

`igdb_id`, `exe_name`, and `window_title` are optional — the agent may not have identified the game yet.

**Response**

```json
{
  "id": "01920f3a-..."
}
```

#### End a pending journey

```
POST /pending-journeys/:id/end
```

Called by the agent when the game process closes.

**Body**

```json
{
  "ended_at": "2026-05-23T16:14:00Z"
}
```

**Response** — `204 No Content`

---

## Comments

### List comments for a journey

```
GET /journeys/:id/comments
```

Flat, chronological order.

**Response**

```json
{
  "comments": [
    {
      "id": "01920f3a-...",
      "player": { Player },
      "body": "Great run!",
      "created_at": "2026-05-23T17:00:00Z"
    }
  ],
  "next_cursor": "..."
}
```

### Post a comment

```
POST /journeys/:id/comments
```

**Body**

```json
{
  "body": "Great run!"
}
```

`body` is plain text up to 400 characters, must not contain a URL, and must not be identical to the author's immediately previous comment. Writes are also subject to the per-user write velocity limit.

**Response**

```json
{
  "id": "01920f3a-...",
  "player": { Player },
  "body": "Great run!",
  "created_at": "2026-05-23T17:00:00Z"
}
```

### Delete a comment

```
DELETE /journeys/:id/comments/:comment_id
```

Only the comment author can delete their own comments.

**Response** — `204 No Content`

---

## Echoes

Echoes are batched — one echo per `(type, subject)` accumulates actors over time rather than producing one notification per actor.

### List echoes

```
GET /echoes
```

In-app notifications for the authenticated user, reverse chronological by `updated_at`.

**Response**

```json
{
  "echoes": [
    {
      "id": "01920f3a-...",
      "type": "new_comment",
      "actors": [ Player, Player ],
      "actor_count": 5,
      "subject_id": "01920f3b-...",
      "subject_title": "Elden Ring",
      "read": false,
      "created_at": "2026-05-23T17:00:00Z",
      "updated_at": "2026-05-24T09:00:00Z"
    },
    {
      "id": "01920f3c-...",
      "type": "new_follower",
      "actors": [ Player ],
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

`type` is `new_comment` or `new_follower`. `subject_id` and `subject_title` are null for `new_follower` echoes. `actors` contains at most 3 players — `actor_count` gives the full total. `subject_title` is snapshotted at creation and remains even if the journey is later deleted. `read` is `false` while `seen_at` is null in the database.

### Mark all echoes as read

```
POST /echoes/read
```

Called by the frontend when the notification panel opens. Marks all unread echoes for the authenticated user as read in one operation.

**Response** — `204 No Content`

---

## Exclusions

### List exclusions

```
GET /exclusions
```

**Response**

```json
{
  "exclusions": [
    {
      "id": "01920f3a-...",
      "exe_name": "launcher.exe",
      "created_at": "2026-05-01T10:00:00Z"
    }
  ]
}
```

### Delete an exclusion

```
DELETE /exclusions/:id
```

**Response** — `204 No Content`

---

## Games

### Search games

```
GET /games/search?q=<query>
```

IGDB-backed game search. Results are cached server-side.

**Response**

```json
{
  "games": [ Game ]
}
```

### Get game

```
GET /games/:igdb_id
```

**Response** — `Game`
