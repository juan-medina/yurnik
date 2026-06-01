# Design

Architecture decisions and the reasoning behind them. This is not a tutorial and not a reference — the code is the reference. Decisions live here so they are not relitigated.

## Terminology

Consistent terms used throughout this document, the codebase, and the UI. When in doubt, use these — not synonyms.

| Term | Meaning |
|------|---------|
| **Journey** | A single confirmed gaming session — one game, one player, one block of time. The core unit of Yurnik. |
| **Pending journey** | A journey that has been detected or started but not yet confirmed by the user. Private, stored in Postgres only, never published. Evicted after 7 days. |
| **Log** | The owner's optional narrative note on a journey, written once at confirmation time. Immutable after confirm. |
| **Player** | A user of Yurnik. Identified by their internal UUID. |
| **Realm** | The home feed — confirmed journeys from players you follow, in reverse chronological order. |
| **Journeys** | The page showing your own journeys — confirmed history and pending confirmation inbox. |
| **Players** | The game-centric discovery page — browse who is playing what. Not a social graph view. |
| **Hero** | Your own profile page — confirmed journey history and stats. |
| **Echo** | An in-app notification. Triggered by a new comment on your journey or a new follower. Batched per subject — one echo per (recipient, type, subject) accumulates actors rather than creating one row per actor. |
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

**Windows tray agent** — a C# application distributed as a Windows installer via Velopack. Watches for games via graphics API detection, creates and heartbeats pending journeys via the API, fires an OS notification with a URL when a game closes. The agent has no UI of its own. Any configuration or journey review opens the web app in the default browser.

## Web frontend — React, TypeScript, Vite, pnpm

React with TypeScript strict mode. No `any`. Vite is the build tool. pnpm is the package manager. Node 22 is pinned via `.node-version` for fnm.

The frontend is a plain SPA deployed to Cloudflare Pages. Static assets are served from Cloudflare's edge globally, with automatic deploys on every push to `main` and preview URLs per pull request. The Go binary serves only API routes — it has no responsibility for static files.

## Database — Supabase, Postgres

Supabase provides managed Postgres. The `pg_cron` extension runs the nightly eviction job for expired unconfirmed journeys. The application connects via a standard Postgres connection string and has no knowledge of the provider.

## Authentication — Discord OAuth

Discord OAuth is the only authentication method. Users log in with their Discord account. Discord was chosen because it has the highest account penetration among the target audience — gamers already have Discord accounts and are used to linking them to third-party services.

The login flow is standard OAuth 2.0 authorization code grant with PKCE, handled entirely server-side:

1. `GET /auth/init?redirect_uri=<uri>` — server generates a PKCE code verifier, stores it in a short-lived state entry, and redirects the browser to the provider.
2. User approves on the provider.
3. Provider redirects back with `?code=…&state=…`.
4. `GET /auth/callback?code=…&state=…` — server exchanges the code using the stored verifier, calls the provider's identity endpoint, upserts the user row, and issues a signed session JWT.
5. `POST /auth/session` — frontend exchanges the completed state for the JWT.

The provider's access token is used once to retrieve the user's identity and then discarded — it is never stored. The session JWT contains the user's internal UUID and is signed with the server's session key. No session state is kept in the database.

The `identify` scope is sufficient — it provides the user's stable numeric ID, username, display name, and avatar. Email is not requested.

### Provider-ready identity model

The users table stores `(provider, provider_id)` as the stable external identity alongside an internal UUID. This means adding a second provider (Google, GitHub) requires only a new OAuth handler — no schema changes. Discord's numeric user ID is the `provider_id`; the internal UUID is what the rest of the system uses. The two are only joined at login.

The agent receives its session token via the `yurnik://auth?token=…` custom URL scheme after the user logs in on the web app.

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
journeys           — confirmed journeys, all data, permanent
pending_journeys   — unconfirmed journeys, evicted after 7 days
follows            — follow graph, written on follow, deleted on unfollow
likes              — one row per (journey, user) pair
comments           — flat, chronological, attached to a journey
exe_exclusions     — per user, executables to never detect
exe_game_hints     — per user, exe_name → igdb_id, built from confirmed corrections
igdb_cache         — server-side IGDB responses with TTL
echoes             — per user, batched notifications; one row per (recipient, type, subject)
echo_actors        — actors who contributed to an echo (commenters, followers, likers)
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

The journey detail query fetches the journey row, its like count, its comments, and whether the requesting user follows the journey owner — all from Postgres.

## Social graph

```
follows(follower_id, followee_id, created_at)
```

Written on follow, deleted on unfollow. Powers the Realm feed join and follower/following lists. New follower echoes are written at the same time as the follow row.

## Likes

```
likes(journey_id, user_id, created_at)
```

One row per (journey, user) pair. Written on like, deleted on unlike. Powers like counts and the liked-by list on journey detail.

Likes are **not surfaced as feed items** in the Realm. The like button appears inline on each Realm feed card and in the journey detail.

Likes **do** trigger an Echo — batched, so "Juan and 2 others liked your journey" is one notification, not three. Liking your own journey does not trigger an echo.

## Log and comments

Two distinct concepts for text attached to a journey:

**Log** — the journey owner's narrative, written once at confirmation time. A field on the `journeys` row. Shown in the Realm feed card and in the journey detail. Only the owner has a log; it cannot be edited after confirm.

**Comments** — text written by any player (including the journey owner) after the journey is confirmed. Separate rows in the `comments` table referencing the journey by ID. Shown in the journey detail only — never in the Realm feed. Flat and chronological — no threading, no hierarchy, no reply-to chains. Comments cannot be liked. A new comment on your journey by another player triggers an Echo; your own comments on your own journey do not.

## Echoes

Echoes are in-app notifications. They use a batched model: one `echoes` row per `(recipient_id, type, subject_id)` that accumulates actors over time, rather than one row per actor. This keeps "Juan and 2 others commented on your journey" as a single notification rather than three.

```
echoes(id, recipient_id, type, subject_id, subject_title, seen_at, created_at, updated_at)
echo_actors(echo_id, actor_id, created_at)
```

`type` is one of `new_comment`, `new_follower`, `new_like`.

`subject_id` is the journey ID for `new_comment` echoes; null for `new_follower` echoes.

`subject_title` is snapshotted from the journey's game name at creation time. If the journey is later deleted, the echo still renders — the link is simply omitted. This mirrors the AT-Proto-era denormalisation rationale: data you reference can disappear.

`seen_at` is null until the user opens the notification panel, at which point `POST /echoes/seen` stamps `seen_at = now()` on all unseen echoes for that user in one query. There is no per-echo read action — opening the panel clears the badge. This matches the Discord interaction model, which is familiar to the target audience.

`updated_at` is bumped each time a new actor is added to an existing echo, so the panel can show the time of most recent activity.

New follower echoes are written in the same transaction as the `follows` row. New comment echoes are written in the same transaction as the `comments` row, unless the commenter is the journey owner. New like echoes are written on like, unless the liker is the journey owner. Unlike does not remove the echo.

## Realm feed

The Realm is the home feed — confirmed journeys from players you follow, reverse chronological. Backed by a single SQL query joining `journeys` against `follows`.

Each journey card in the feed is fully renderable from the `journeys` row joined with `users` and `igdb_games` — no secondary lookups needed per card.

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
- Like button — the only place the like action is exposed
- Liked-by avatars — a subset shown inline, expandable to the full list
- Comments — flat, chronological, posted by any player including the owner; not likeable
- **Following on this journey** — people you follow who have also played this game, ordered by most recent journey, up to 20
- **Others on this journey** — players outside your follow graph who have played this game, ordered by most recent journey, up to 20

## IGDB

IGDB (owned by Twitch) is free for non-commercial use and is the most comprehensive game database available. Used for game metadata, cover art, genres, and similar game relationships. The Twitch client secret lives server-side only — the frontend and clients never touch it.

IGDB responses are cached in Postgres with a TTL. Clients read game metadata from the denormalised fields stored on journey rows.

## Custom URL scheme

The agent registers `yurnik://` as a custom URL scheme on install via Velopack. Its sole purpose is the OAuth callback: after the user completes Discord OAuth in the browser, the web app redirects to `yurnik://auth?token=...`, the OS routes this to the running agent, and the agent stores the token.

## Time and timestamps

Full timestamps (start and end in UTC) are stored on every journey row — needed for feed ordering and duration display. Duration is derived; it is never stored separately.

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. The C# agent uses xUnit. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.
