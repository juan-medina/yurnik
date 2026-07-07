# Design

System structure and how its parts work together. Not a tutorial and not a reference — the code is the reference. For why things are the way they are, see [DECISIONS.md](DECISIONS.md).

## Terminology

Consistent terms used throughout this document, the codebase, and the UI. When in doubt, use these — not synonyms.

| Term | Meaning |
|------|---------|
| **Journey** | A single confirmed gaming session — one game, one player, one block of time. The core unit of Yurnik. |
| **Pending journey** | A journey that has been detected or started but not yet confirmed by the user. Private, stored in Postgres only, never published. Evicted after 30 days. |
| **Log** | The owner's optional narrative note on a journey. Written at confirmation time and editable by the owner afterwards. |
| **Player** | A user of Yurnik. Identified by their internal UUID. |
| **Realm** | The home feed — confirmed journeys from players you follow, in reverse chronological order. |
| **Journeys** | The page showing your own journeys — confirmed history and pending confirmation inbox. |
| **Players** | The game-centric discovery page — browse who is playing what. Not a social graph view. |
| **Hero** | Your own profile page — confirmed journey history and stats. |
| **Echo** | An in-app notification. Triggered by a new comment on your journey or a new follower. Batched per subject — one echo per (recipient, type, subject) accumulates actors rather than creating one row per actor. |
| **Horizon** | A player's public list of games they intend to play in the future, shown on their Hero page. Added from a game's detail page or the Horizon page; removable only from the Horizon page. |
| **Exclusion** | An executable the agent will never create a pending journey for. |

## What we are building

A social feed for gaming journeys. Two ways a journey is created: the user logs one directly on the web app; or a client detects a running game, proposes a journey when the process closes, and the user confirms or discards it. Either way, confirmed journeys appear in followers' feeds.

Discovery and recommendations are a secondary goal, enabled by the journey data that accumulates over time.

## Core product

Two things form the core product:

**API server** — a single Go binary. Handles all backend logic, proxies IGDB with a server-side cache, holds unconfirmed journeys until the user acts on them, and serves the exclusion list to clients.

**Web frontend** — a React SPA deployed to Cloudflare Pages. Handles journey confirmation, the social feed, game search, personal stats, and exclusion management. Works standalone — no client installation required.

## Clients

Clients are optional. The web app is fully functional without any client installed.

**Windows tray agent** — a C# application distributed as a Windows installer via Velopack. Watches for games via graphics API detection, creates pending journeys via the API, fires an OS notification with a URL when a game closes. The agent has no UI of its own. Any configuration or journey review opens the web app in the default browser.

## Web frontend — React, TypeScript, Vite, pnpm

React with TypeScript strict mode. No `any`. Vite is the build tool. pnpm is the package manager. Node 22 is pinned via `.node-version` for fnm.

The frontend is a SPA deployed to Cloudflare Pages. Static assets are served from Cloudflare's edge globally, with automatic deploys on every push to `main` and preview URLs per pull request. A Cloudflare Worker runs at the edge to intercept requests from bots (for SEO and social sharing), dynamically injecting Open Graph, Twitter, and standard meta tags, as well as JSON-LD structured data. The Go binary serves only API routes and the dynamic `sitemap.xml` proxy endpoint.

## Database — Postgres

Postgres runs on the same Hetzner VPS as the API server. A daily standalone maintenance binary (`yurnik-maintenance`) handles data eviction (e.g. unconfirmed journeys, old echoes).

## Authentication — Discord OAuth

Discord OAuth is the only authentication method. Users log in with their Discord account.

The login flow is standard OAuth 2.0 authorization code grant with PKCE, handled entirely server-side:

1. `GET /auth/init?redirect_uri=<uri>` — server generates a PKCE code verifier, stores it in a short-lived state entry, and redirects the browser to the provider.
2. User approves on the provider.
3. Provider redirects back with `?code=…&state=…`.
4. `GET /auth/callback?code=…&state=…` — server exchanges the code using the stored verifier, calls the provider's identity endpoint, upserts the user row, and issues a signed session JWT.
5. `POST /auth/session` — frontend exchanges the completed state for the JWT.

The provider's access token is used once to retrieve the user's identity and then discarded — it is never stored. The session JWT contains the user's internal UUID and is signed with the server's session key. No session state is kept in the database.

The `identify` scope is sufficient — it provides the user's stable numeric ID, username, display name, and avatar. Email is not requested.

### Provider-ready identity model

The users table stores `(provider, provider_id)` as the stable external identity alongside an internal UUID. Discord's numeric user ID is the `provider_id`; the internal UUID is what the rest of the system uses. The two are only joined at login.

The agent receives its session token via the `yurnik://auth?token=…` custom URL scheme after the user logs in on the web app.

Session JWTs last 7 days and are renewed by the server if presented while older than 24 hours. While running, the agent periodically calls `/api/v1/agent/heartbeat` to pick up a renewed token, so a long-running agent stays authenticated without prompting the user to log in again.

## API server

A single Go binary. Handles all API routes, proxies IGDB with a server-side cache, and manages session tokens. One binary, one process, one thing to monitor and deploy. No gateway, no reverse proxy, no separate services.

## Game detection

The Windows tray agent detects games by watching for new processes that load a graphics API — DirectX, OpenGL, or Vulkan. When a matching process closes, the agent looks up the executable name and window title against IGDB via the API server to identify the game, then creates a pending journey.

The agent does not maintain a proprietary executable database. Detection relies on graphics API DLL enumeration and fuzzy window title matching against IGDB. `exe_game_hints` accelerates repeat detections by caching confirmed exe → game mappings per user.

## Data model

Postgres is the single source of truth. There is no external record store.

```
users              — one row per player, keyed on internal UUID
                     provider + provider_id identify the user at login
                     is_admin flag grants access to admin routes
                     suspended_at non-null means the account is suspended
journeys           — confirmed journeys, all data, permanent
pending_journeys   — unconfirmed journeys, evicted after 30 days
follows            — follow graph, written on follow, deleted on unfollow
comments           — flat, chronological, attached to a journey
exe_exclusions     — per user, executables to never detect
exe_game_hints     — per user, exe_name → igdb_id, built from confirmed corrections
igdb_cache         — server-side IGDB responses with TTL
echoes             — per user, batched notifications; one row per (recipient, type, subject)
echo_actors        — actors who contributed to an echo (commenters, followers)
reports            — one row per (reporter, target); unique constraint prevents duplicate reports
```

```
localStorage       — UI preferences only
```

## Journeys

`journeys` is the primary table. It holds all journey data — there is no separate index or external record. A row is written when the user confirms a journey (from pending) or logs one manually via the web app.

```
journeys(id, user_id, igdb_id, started_at, ended_at, log, played_at, created_at)
```

The Realm feed query joins `journeys` against `follows` to return journeys from followed players — one SQL query.

The journey detail query fetches the journey row, its comments, and whether the requesting user follows the journey owner — all from Postgres.

## Social graph

```
follows(follower_id, followee_id, created_at)
```

Written on follow, deleted on unfollow. Powers the Realm feed join and follower/following lists. New follower echoes are written at the same time as the follow row.

## Log and comments

Two distinct concepts for text attached to a journey:

**Log** — the journey owner's narrative, written at confirmation time and editable by the owner afterwards. A field on the `journeys` row. Shown in the Realm feed card and in the journey detail. Only the owner has a log.

**Comments** — text written by any player (including the journey owner) after the journey is confirmed. Separate rows in the `comments` table referencing the journey by ID. Shown in the journey detail only — never in the Realm feed. Flat and chronological — no threading, no hierarchy, no reply-to chains. Comments cannot be liked. A new comment on your journey by another player triggers an Echo; your own comments on your own journey do not.

Both fields are capped at 400 characters and rendered as plain text (`white-space: pre-wrap` — line breaks preserved, no markdown or HTML). See [CLAUDE.md](../.claude/CLAUDE.md#user-generated-text-and-spam-prevention) for the validation and anti-spam rules applied to both fields.

## Echoes

Echoes are in-app notifications. They use a batched model: one `echoes` row per `(recipient_id, type, subject_id)` that accumulates actors over time, rather than one row per actor.

```
echoes(id, recipient_id, type, subject_id, subject_title, seen_at, created_at, updated_at)
echo_actors(echo_id, actor_id, created_at)
```

`type` is one of `new_comment`, `new_follower`.

`subject_id` is the journey ID for `new_comment` echoes; null for `new_follower` echoes.

`subject_title` is snapshotted from the journey's game name at creation time. If the journey is later deleted, the echo still renders — the link is simply omitted.

`seen_at` is null until the user opens the notification panel, at which point `POST /echoes/seen` stamps `seen_at = now()` on all unseen echoes for that user in one query. There is no per-echo read action — opening the panel clears the badge.

`updated_at` is bumped each time a new actor is added to an existing echo, so the panel can show the time of most recent activity.

Echoes that have received no new activity for 60 days (i.e. `updated_at` is older than 60 days) are evicted by the daily maintenance job to prevent the table from growing indefinitely. Because of the batched model, a popular journey with frequent new comments will keep its echo alive as long as people keep engaging with it.

New follower echoes are written in the same transaction as the `follows` row. New comment echoes are written in the same transaction as the `comments` row, unless the commenter is the journey owner.

## Realm feed

The Realm is the home feed — confirmed journeys from players you follow, reverse chronological. Backed by a single SQL query joining `journeys` against `follows`.

Each journey card in the feed is fully renderable from the `journeys` row joined with `users` and `igdb_games` — no secondary lookups needed per card.

## Player profile

The player profile (`/hero` for the authenticated user, `/player/:id` for others) is driven by a single aggregated endpoint — `GET /api/players/:id/profile` or `GET /api/me/profile`. The response includes everything the page needs in one round trip: player identity, follow counts, journey count, total playtime, recent games, and genre hours. The frontend renders; it does not aggregate.

**Recent games** — the five most recently played distinct games, ordered by `MAX(played_at)` descending.

**Genre hours** — total seconds played in games that have a given genre, top eight by volume. A game with three genres contributes its full duration to each genre. The bars are sized relative to the highest genre — absolute hours are shown on the label. Total exceeds 100%; this is expected and correct.

## Players page

The Players page shows recent journeys grouped by game, across all players. Powers game discovery — see who is playing what. The data backing this page is the `journeys` table, ordered by `played_at` descending, grouped by `igdb_id`.

Each game card shows:
- Game cover art, title, and genre chips
- A row per recent journey: player avatar, name, duration, date, and log excerpt (truncated)
- Journey count for the game

Clicking a player row navigates to that player's profile. Clicking a journey row navigates to the journey detail.

## Journey detail

Tapping a journey card opens the journey detail at `/journey/:id`. It shows:

- Full journey metadata and log
- Comments — flat, chronological, posted by any player including the owner
- **Following on this journey** — people you follow who have also played this game, ordered by most recent journey, up to 20
- **Others on this journey** — players outside your follow graph who have played this game, ordered by most recent journey, up to 20

## IGDB

IGDB is used for game metadata, cover art, genres, and similar game relationships. The Twitch client secret lives server-side only — the frontend and clients never touch it.

IGDB responses are cached in Postgres with a TTL. Clients read game metadata from the denormalised fields stored on journey rows.

## Custom URL scheme

The agent registers `yurnik://` as a custom URL scheme on install via Velopack. Its sole purpose is the OAuth callback: after the user completes Discord OAuth in the browser, the web app redirects to `yurnik://auth?token=...`, the OS routes this to the running agent, and the agent stores the token.

## Time and timestamps

Full timestamps (start and end in UTC) are stored on every journey row — needed for feed ordering and duration display. Duration is derived; it is never stored separately.

## Moderation

Moderation is built around a report-then-act model. Users flag content; admins review and act. There is no automated removal.

**Admin role** — the `is_admin` boolean on the `users` row. Set directly in the database; there is no self-service promotion flow. Admin status gates all `/api/admin/*` routes, checked on every request.

**Reporting** — any authenticated user can report a journey log, a comment, or a profile via `POST /api/reports`. Reports are stored in the `reports` table. A unique constraint on `(reporter_id, target_type, target_id)` prevents duplicate reports from the same user. The velocity limiter applies to report submissions (20-minute minimum interval, escalating up to 24 hours for repeat violations) to prevent report-flooding.

Target types:
- `journey_log` — the `log` field on a journey row; `target_id` is the journey UUID
- `comment` — a row in the `comments` table; `target_id` is the comment UUID, `context_id` is the journey UUID
- `profile` — a user's display name, bio, or avatar; `target_id` is the user UUID

Valid reasons: `spam`, `harassment`, `hate_speech`, `explicit`, `impersonation`, `private_info`, `other`. Reason `other` requires a note (max 200 characters).

**Admin actions** — admins can:
- List all reports (`GET /api/admin/reports`)
- Suspend a user (`POST /api/admin/users/{id}/suspend`) — sets `suspended_at`; suspended users cannot authenticate
- Unsuspend a user (`DELETE /api/admin/users/{id}/suspend`)
- List suspended users (`GET /api/admin/users/suspended`)
- Reset a user's profile (`POST /api/admin/users/{id}/reset-profile`) — clears `custom_avatar_url` and `display_name`, reverting to Discord values
- Clear a journey log (`DELETE /api/admin/journeys/{id}/log`) — sets `log = NULL` on the journey row
- Delete a comment (`DELETE /api/admin/comments/{id}`)

Reports are not automatically resolved or dismissed — there is no resolved/dismissed state on the `reports` table. The admin reviews the queue and takes action directly on the content or account.

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. The C# agent uses xUnit. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.
