# API Design

Agōn Go API server — endpoint reference. All routes are served from the same binary. Prefix every path with `/api/v1`.

## Conventions

- **Base URL** — `https://api.agon.social/api/v1` (production). The frontend reads `VITE_API_BASE_URL` at build time.
- **Encoding** — JSON throughout. `Content-Type: application/json` on all request bodies.
- **Timestamps** — RFC 3339 UTC in all requests and responses (`"2026-05-23T14:30:00Z"`).
- **Durations** — integer seconds in requests and responses. Clients format for display (`11640` → `"3h 14m"`).
- **Player identity** — players are identified by their AT Proto DID (`did:plc:…`). Handles (`maria.bsky.social`) are sourced from the Bluesky PDS and treated as display names, not stable identifiers.
- **Journey IDs** — confirmed journeys use their AT Proto rkey. Pending sessions use server-generated UUIDs.
- **Pagination** — cursor-based. Responses include `"next_cursor"` when a further page exists. Pass `cursor=<value>` to advance. `limit` defaults to 20, max 50.

## Authentication

Bluesky OAuth only. The web app flow:

1. `GET /auth/login?handle=<handle>&redirect_uri=<uri>` — server returns an authorization URL.
2. User completes OAuth in the browser.
3. Bluesky redirects to `redirect_uri` with `?code=…&state=…`.
4. `GET /auth/callback?code=…&state=…` — server exchanges the code and returns a session token.

The agent receives its token via the `agon://auth?token=…` custom URL scheme after the user logs in on the web app. The web app passes the token to the agent at the end of its own OAuth flow.

All authenticated endpoints require:

```
Authorization: Bearer <session_token>
```

## Rate Limiting

| Layer | Scope | Limit |
|---|---|---|
| Cloudflare | Per IP | 100 req / minute |
| Go API (token bucket) | Global | 200 req / second |
| IGDB proxy | Upstream calls | 4 req / second |

Exceeded limits → `429 Too Many Requests` with a `Retry-After` header.

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
| 409 | `conflict` | Resource already exists (duplicate like, duplicate exclusion) |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Server fault |

---

## Shared Types

### Player

```json
{
  "did": "did:plc:abc123",
  "handle": "maria.bsky.social",
  "name": "Maria Chen",
  "avatar_url": "https://cdn.bsky.app/...",
  "bio": "Chasing bosses and logging every moment.",
  "follower_count": 142,
  "following_count": 37,
  "color": "#7c3aed"
}
```

`avatar_url` and `bio` are optional. `color` is a server-assigned accent hex used as an avatar fallback.

### Game

```json
{
  "igdb_id": 119133,
  "title": "Elden Ring",
  "cover_url": "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
  "cover_color": "#3d2b1f",
  "cover_accent": "#c9a84c",
  "genres": ["RPG", "Soulslike", "Open World"]
}
```

`cover_url` is optional — IGDB does not guarantee a cover for every game.

### Journey (confirmed)

```json
{
  "id": "3jzfszdy",
  "at_uri": "at://did:plc:abc123/app.agon.journey/3jzfszdy",
  "player": { },
  "game": { },
  "duration_seconds": 11640,
  "started_at": "2026-05-23T10:00:00Z",
  "played_at": "2026-05-23T13:14:00Z",
  "log": "Finally took down Malenia after 40 attempts.",
  "like_count": 47,
  "liked_by_me": false
}
```

`log` and `started_at` are optional. `liked_by_me` reflects the authenticated user's like state.

### PendingSession

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "ended",
  "game": { },
  "duration_seconds": 6720,
  "started_at": "2026-05-23T10:00:00Z",
  "ended_at": "2026-05-23T11:52:00Z",
  "exe_name": "cyberpunk2077.exe",
  "window_title": "Cyberpunk 2077"
}
```

`status`: `"active"` | `"ended"`. `game` is `null` when no IGDB match was found. `exe_name` and `window_title` are present only for agent-detected sessions.

### Comment

```json
{
  "id": "cm_xyz",
  "at_uri": "at://did:plc:abc123/app.agon.comment/cm_xyz",
  "player": { },
  "text": "40 attempts is wild, respect.",
  "commented_at": "2026-05-23T14:12:00Z"
}
```

### Echo

```json
{
  "id": "ech_abc",
  "kind": "comment",
  "player": { },
  "occurred_at": "2026-05-23T13:52:00Z",
  "read": false,
  "journey_id": "3jzfszdy",
  "game_title": "Elden Ring",
  "comment_preview": "40 attempts is wild, respect. I gave up at 20."
}
```

`kind`: `"comment"` | `"follower"`. For `kind: "follower"`, `journey_id`, `game_title`, and `comment_preview` are absent.

---

## Endpoints

### Auth

#### `GET /auth/login`

Initiates the Bluesky OAuth flow. Returns the authorization URL to redirect the user to.

**Query params**

| Param | Required | Description |
|---|---|---|
| `handle` | yes | Bluesky handle — used to resolve the user's PDS |
| `redirect_uri` | yes | Where Bluesky sends the code after auth |

**Response `200`**

```json
{ "authorization_url": "https://bsky.social/oauth/authorize?client_id=...&state=..." }
```

---

#### `GET /auth/callback`

Exchanges an OAuth authorization code for a session token. Called by the web app after Bluesky redirects back.

**Query params**

| Param | Required | Description |
|---|---|---|
| `code` | yes | Authorization code from Bluesky |
| `state` | yes | CSRF state token from the original login request |

**Response `200`**

```json
{
  "token": "agon_tok_...",
  "player": { }
}
```

---

#### `POST /auth/logout`

Invalidates the current session token.

**Auth** required.

**Response `204`** No body.

---

### Me

#### `GET /me`

Returns the authenticated player's profile.

**Auth** required.

**Response `200`** — Player object.

---

#### `PATCH /me`

Updates the authenticated player's display name and/or bio on their Bluesky PDS profile.

**Auth** required.

**Request body** — all fields optional; only provided fields are updated.

```json
{
  "name": "Maria Chen",
  "bio": "Updated bio."
}
```

**Response `200`** — Updated Player object.

---

#### `PUT /me/avatar`

Uploads a new avatar. Stores on the Bluesky PDS blob store.

**Auth** required.

**Request** `Content-Type: multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `file` | yes | JPEG or PNG, max 2 MB |

**Response `200`**

```json
{ "avatar_url": "https://cdn.bsky.app/..." }
```

---

### Feed

#### `GET /feed`

Returns confirmed journeys from players the authenticated user follows on Agōn, reverse chronological. Backed by `journeys_index` joined against `players_index` — a single SQL query with no per-user AT Proto calls.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Max journeys (max 50) |
| `cursor` | — | Pagination cursor from previous response |

**Response `200`**

```json
{
  "journeys": [ ],
  "next_cursor": "eyJ..."
}
```

`next_cursor` is absent when there are no more pages.

---

### Journeys

#### `GET /journeys/:id`

Returns a single confirmed journey.

**Auth** required.

**Path params**

| Param | Description |
|---|---|
| `id` | AT Proto rkey for the journey record |

**Response `200`** — Journey object.

**Response `404`** — `not_found`

---

#### `POST /journeys`

Manually logs a new confirmed journey, publishing it to AT Proto immediately and writing a row to `journeys_index`. Used by the web app when no agent is installed.

**Auth** required.

**Request body**

```json
{
  "igdb_id": 119133,
  "duration_seconds": 6720,
  "played_at": "2026-05-23T00:00:00Z",
  "log": "Optional narrative note."
}
```

| Field | Required | Description |
|---|---|---|
| `igdb_id` | yes | IGDB game ID |
| `duration_seconds` | yes | Journey length in seconds, min 60 |
| `played_at` | yes | End timestamp — when the user finished playing |
| `log` | no | Journey note, max 300 chars |

**Response `201`** — Journey object.

---

#### `DELETE /journeys/:id`

Owner only. Deletes the `app.agon.journey` AT Proto record and removes the corresponding rows from `journeys_index`, `likes_index`, and `comments_index`. Likes and comments in other players' AT Proto storage are not deleted — they reference a URI that will no longer resolve.

**Auth** required.

**Response `204`** No body.

**Response `403`** — `forbidden` — authenticated DID is not the journey owner.

**Response `404`** — `not_found` — journey does not exist.

---

#### `POST /journeys/:id/like`

Likes a journey. Creates an `app.agon.like` AT Proto record in the authenticated user's storage and writes a row to `likes_index`.

**Auth** required.

**Response `200`**

```json
{ "like_count": 48 }
```

**Response `409`** — `conflict` — already liked.

---

#### `DELETE /journeys/:id/like`

Removes a like from a journey. Deletes the `app.agon.like` AT Proto record and removes the row from `likes_index`.

**Auth** required.

**Response `200`**

```json
{ "like_count": 46 }
```

**Response `404`** — `not_found` — like does not exist.

---

#### `GET /journeys/:id/likers`

Returns the players who liked a journey. Backed by `likes_index`.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Max likers (max 100) |
| `cursor` | — | Pagination cursor |

**Response `200`**

```json
{
  "likers": [ ],
  "next_cursor": "eyJ..."
}
```

---

#### `GET /journeys/:id/comments`

Returns comments for a journey in chronological order. Backed by `comments_index`.

**Auth** required.

**Response `200`**

```json
{
  "comments": [ ]
}
```

Comments are not paginated — expected volume is low.

---

#### `POST /journeys/:id/comments`

Posts a comment on a journey. Creates an `app.agon.comment` AT Proto record in the authenticated user's storage and writes a row to `comments_index`. Does not create an echo if the commenter is the journey owner.

**Auth** required.

**Request body**

```json
{ "text": "40 attempts is wild, respect." }
```

| Field | Required | Description |
|---|---|---|
| `text` | yes | 1–500 chars |

**Response `201`** — Comment object.

---

#### `DELETE /journeys/:id/comments/:comment_id`

Comment author only. Deletes the `app.agon.comment` AT Proto record and removes the row from `comments_index`.

**Auth** required.

**Response `204`** No body.

**Response `403`** — `forbidden` — authenticated DID is not the comment author.

**Response `404`** — `not_found` — comment does not exist.

---

#### `GET /journeys/:id/journey-players`

Returns players who have also played this game, split into friends (followed by the authenticated user on Agōn) and others. Backed by `journeys_index` joined against `players_index`. Each list is capped at 20 entries, ordered by `played_at` descending.

**Auth** required.

**Response `200`**

```json
{
  "friends": [
    {
      "player": { },
      "duration_seconds": 9840,
      "played_at": "2026-05-21T00:00:00Z",
      "journey_id": "abc123",
      "is_following": true
    }
  ],
  "others": [ ]
}
```

---

### Pending Sessions

Unconfirmed sessions — either detected by the agent or in the process of being confirmed manually. Stored in Postgres; evicted after 7 days.

#### `GET /pending-sessions`

Returns pending sessions for the authenticated user with status `active` or `ended`.

**Auth** required.

**Response `200`**

```json
{
  "pending_sessions": [ ]
}
```

---

#### `POST /pending-sessions/:id/confirm`

Confirms a pending session. Publishes an `app.agon.journey` record to AT Proto, writes a row to `journeys_index`, and deletes the pending record from Postgres.

**Auth** required.

**Request body**

```json
{
  "igdb_id": 119133,
  "log": "Optional narrative note."
}
```

| Field | Required | Description |
|---|---|---|
| `igdb_id` | yes | IGDB game ID — may differ from the detected suggestion if the user corrects it |
| `log` | no | Journey note, max 300 chars |

If `igdb_id` differs from the detected suggestion and the session has an `exe_name`, the server writes an `exe_game_hints` row for this user so future sessions from the same exe skip fuzzy matching.

**Response `201`** — Journey object (the newly confirmed journey).

---

#### `POST /pending-sessions/:id/discard`

Discards a pending session permanently.

**Auth** required.

**Response `204`** No body.

---

#### `POST /pending-sessions/:id/exclude`

Discards a pending session and adds its associated executable to the user's exclusion list. Only valid when the pending session has an `exe_name`.

**Auth** required.

**Response `204`** No body.

**Response `400`** — `invalid_request` — session has no associated executable.

---

### Games

IGDB proxy. Responses are cached in Postgres with a TTL. A cache hit never results in an upstream IGDB call.

#### `GET /games/search`

Searches IGDB for games by title.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `q` | — | Search query, min 2 chars, required |
| `limit` | `6` | Max results (max 20) |

**Response `200`**

```json
{
  "games": [ ]
}
```

---

#### `GET /games/:igdb_id`

Returns metadata for a specific game by IGDB ID.

**Auth** required.

**Path params**

| Param | Description |
|---|---|
| `igdb_id` | Integer IGDB game ID |

**Response `200`** — Game object.

**Response `404`** — `not_found` — game not found in IGDB.

---

### Players

#### `GET /players/:handle`

Returns a player's public profile.

**Auth** required.

**Path params**

| Param | Description |
|---|---|
| `handle` | Bluesky handle (e.g., `maria.bsky.social`) |

**Response `200`** — Player object.

**Response `404`** — `not_found`

---

#### `GET /players/:handle/journeys`

Returns confirmed journeys for a player, reverse chronological. Backed by `journeys_index`.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Max journeys (max 50) |
| `cursor` | — | Pagination cursor |

**Response `200`**

```json
{
  "journeys": [ ],
  "next_cursor": "eyJ..."
}
```

---

#### `GET /players/:handle/followers`

Returns the player's Agōn followers. Backed by `players_index`.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Max results (max 100) |
| `cursor` | — | Pagination cursor |

**Response `200`**

```json
{
  "followers": [ ],
  "next_cursor": "eyJ..."
}
```

---

#### `GET /players/:handle/following`

Returns the list of players this player follows on Agōn. Backed by `players_index`.

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `limit` | `20` | Max results (max 100) |
| `cursor` | — | Pagination cursor |

**Response `200`**

```json
{
  "following": [ ],
  "next_cursor": "eyJ..."
}
```

---

#### `POST /players/:handle/follow`

Follows a player on Agōn. Creates an `app.agon.player` AT Proto record in the authenticated user's storage, writes a row to `players_index`, and creates a follower echo for the followed player.

**Auth** required.

**Response `200`**

```json
{ "follower_count": 143 }
```

**Response `409`** — `conflict` — already following.

---

#### `DELETE /players/:handle/follow`

Unfollows a player on Agōn. Deletes the `app.agon.player` AT Proto record and removes the row from `players_index`.

**Auth** required.

**Response `200`**

```json
{ "follower_count": 141 }
```

---

### Discovery

Game-centric discovery feed powering the Players page. Returns recent journeys grouped by game, ordered by the most recent journey per group descending. Backed by `journeys_index`.

#### `GET /discovery`

**Auth** required.

**Query params**

| Param | Default | Description |
|---|---|---|
| `q` | — | Filter by game title or genre (min 2 chars) |
| `genre` | — | Filter by exact genre name |
| `limit` | `20` | Max game groups (max 50) |
| `cursor` | — | Pagination cursor |

**Response `200`**

```json
{
  "activity": [
    {
      "game": { },
      "journey_count": 12,
      "entries": [
        {
          "journey_id": "s1",
          "player": { },
          "duration_seconds": 11640,
          "played_at": "2026-05-23T13:14:00Z",
          "log": "Finally took down Malenia..."
        }
      ]
    }
  ],
  "next_cursor": "eyJ..."
}
```

Each game group includes up to 5 most recent journeys. The full journey is at `GET /journeys/:id`.

---

### Echoes

#### `GET /echoes`

Returns the authenticated user's echoes (notifications), reverse chronological.

**Auth** required.

**Response `200`**

```json
{
  "echoes": [ ],
  "unread_count": 3
}
```

---

#### `POST /echoes/read`

Marks all echoes as read.

**Auth** required.

**Response `204`** No body.

---

### Exclusions

Executables the agent must not create sessions for.

#### `GET /exclusions`

Returns the authenticated user's full exclusion list.

**Auth** required.

**Response `200`**

```json
{
  "exclusions": [
    { "exe_name": "launcher.exe" }
  ]
}
```

---

#### `POST /exclusions`

Adds an executable to the exclusion list.

**Auth** required.

**Request body**

```json
{ "exe_name": "launcher.exe" }
```

**Response `201`**

```json
{ "exe_name": "launcher.exe" }
```

**Response `409`** — `conflict` — already in the list.

---

#### `DELETE /exclusions/:exe_name`

Removes an executable from the exclusion list.

**Auth** required.

**Path params**

| Param | Description |
|---|---|
| `exe_name` | Executable filename, URL-encoded |

**Response `204`** No body.

---

### Game Hints

Learned exe → IGDB ID mappings built from confirmed user corrections. Used by the server to skip fuzzy matching on repeat detections from the same executable.

#### `GET /game-hints`

Returns the authenticated user's game hints.

**Auth** required.

**Response `200`**

```json
{
  "game_hints": [
    {
      "exe_name": "eldenring.exe",
      "game": { }
    }
  ]
}
```

---

#### `PUT /game-hints/:exe_name`

Creates or replaces the game hint for an executable.

**Auth** required.

**Request body**

```json
{ "igdb_id": 119133 }
```

**Response `200`**

```json
{
  "exe_name": "eldenring.exe",
  "game": { }
}
```

---

#### `DELETE /game-hints/:exe_name`

Removes a game hint.

**Auth** required.

**Path params**

| Param | Description |
|---|---|
| `exe_name` | Executable filename, URL-encoded |

**Response `204`** No body.

---

### Agent

Routes used exclusively by the Windows tray agent. The agent authenticates with the same bearer token issued to the user at login — passed via `agon://auth?token=…` at the end of the web OAuth flow.

#### `POST /agent/sessions`

Creates an active pending session when a game process is detected. The server checks the exclusion list and `exe_game_hints` before attempting IGDB fuzzy matching on `window_title`.

**Auth** required.

**Request body**

```json
{
  "exe_name": "eldenring.exe",
  "window_title": "ELDEN RING"
}
```

**Response `201`** — pending session created.

```json
{
  "session_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "game": { }
}
```

`game` is `null` when no IGDB match was found.

**Response `200`** — exe is excluded, no session created.

```json
{ "excluded": true }
```

---

#### `PUT /agent/sessions/:id/heartbeat`

Updates the last-seen timestamp on an active session. Sessions with no heartbeat for 15 minutes are auto-closed by the server.

**Auth** required.

**Response `204`** No body.

**Response `404`** — `not_found` — session not found or already closed.

---

#### `PUT /agent/sessions/:id/end`

Marks a session as `ended` when the game process closes. The server queues an in-app notification to the user.

**Auth** required.

**Request body** — optional, sent when a better title is available at close time.

```json
{ "window_title": "Elden Ring - Shadow of the Erdtree" }
```

**Response `200`** — PendingSession object.

---

#### `GET /agent/exclusions`

Returns the full exclusion list for the authenticated user. The agent fetches this on startup and before each new process detection to decide whether to call `POST /agent/sessions`.

**Auth** required.

**Response `200`**

```json
{
  "exclusions": [
    { "exe_name": "launcher.exe" }
  ]
}
```

---

## Route Summary

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/auth/login` | — | Initiate Bluesky OAuth |
| GET | `/auth/callback` | — | Exchange OAuth code for token |
| POST | `/auth/logout` | ✓ | Invalidate session token |
| GET | `/me` | ✓ | Current player profile |
| PATCH | `/me` | ✓ | Update name / bio |
| PUT | `/me/avatar` | ✓ | Upload avatar |
| GET | `/feed` | ✓ | Realm feed — journeys from Agōn following |
| GET | `/journeys/:id` | ✓ | Journey detail |
| POST | `/journeys` | ✓ | Manually log a journey |
| DELETE | `/journeys/:id` | ✓ | Delete a journey |
| POST | `/journeys/:id/like` | ✓ | Like a journey |
| DELETE | `/journeys/:id/like` | ✓ | Unlike a journey |
| GET | `/journeys/:id/likers` | ✓ | Who liked a journey |
| GET | `/journeys/:id/comments` | ✓ | Journey comments |
| POST | `/journeys/:id/comments` | ✓ | Post a comment |
| DELETE | `/journeys/:id/comments/:comment_id` | ✓ | Delete a comment |
| GET | `/journeys/:id/journey-players` | ✓ | Friends and others on the same game |
| GET | `/pending-sessions` | ✓ | Pending (unconfirmed) sessions |
| POST | `/pending-sessions/:id/confirm` | ✓ | Confirm — publish to AT Proto |
| POST | `/pending-sessions/:id/discard` | ✓ | Discard pending session |
| POST | `/pending-sessions/:id/exclude` | ✓ | Discard + add exe to exclusion list |
| GET | `/games/search` | ✓ | IGDB game search |
| GET | `/games/:igdb_id` | ✓ | Game metadata by IGDB ID |
| GET | `/players/:handle` | ✓ | Player profile |
| GET | `/players/:handle/journeys` | ✓ | Player's confirmed journey history |
| GET | `/players/:handle/followers` | ✓ | Player's Agōn followers |
| GET | `/players/:handle/following` | ✓ | Player's Agōn following list |
| POST | `/players/:handle/follow` | ✓ | Follow a player on Agōn |
| DELETE | `/players/:handle/follow` | ✓ | Unfollow a player on Agōn |
| GET | `/discovery` | ✓ | Game-centric discovery feed (Players page) |
| GET | `/echoes` | ✓ | Notification list |
| POST | `/echoes/read` | ✓ | Mark all echoes read |
| GET | `/exclusions` | ✓ | Exe exclusion list |
| POST | `/exclusions` | ✓ | Add exclusion |
| DELETE | `/exclusions/:exe_name` | ✓ | Remove exclusion |
| GET | `/game-hints` | ✓ | Exe → game hint mappings |
| PUT | `/game-hints/:exe_name` | ✓ | Set or replace a game hint |
| DELETE | `/game-hints/:exe_name` | ✓ | Remove a game hint |
| POST | `/agent/sessions` | ✓ | Agent: game process detected |
| PUT | `/agent/sessions/:id/heartbeat` | ✓ | Agent: session heartbeat |
| PUT | `/agent/sessions/:id/end` | ✓ | Agent: game process closed |
| GET | `/agent/exclusions` | ✓ | Agent: fetch exclusion list |
