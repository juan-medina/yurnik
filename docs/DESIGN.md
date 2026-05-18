# Design

Architecture decisions and the reasoning behind them. This is not a tutorial and not a reference — the code is the reference. Decisions live here so they are not relitigated.

## What we are building

A social feed for gaming sessions, built on AT Proto. The core loop: a client detects or the user manually logs when they are playing a game and for how long, proposes a session record when they stop, the user confirms or discards it, confirmed sessions publish to their AT Proto feed and become visible to followers.

Discovery and recommendations are a secondary goal, enabled by the session data that accumulates over time.

## Core product

Two things form the core product:

**API server** — a single Go binary. Handles all backend logic, proxies IGDB with a server-side cache, holds unconfirmed sessions until the user acts on them, and serves the exclusion list to clients.

**Web frontend** — a React SPA deployed to Cloudflare Pages. Handles session confirmation, the social feed, game search, personal stats, and exclusion management. Works standalone — no client installation required. Users who only play on platforms without an automatic detection client (PS5, Switch, etc.) log sessions manually through the web app.

## Clients

Clients are optional. The web app is fully functional without any client installed.

**Windows tray agent** — a C# application distributed as a Windows installer via Velopack. Watches for games via graphics API detection, creates and heartbeats sessions via the API, fires an OS notification with a URL when a game closes. Has no UI beyond a system tray icon and a quit menu item. Registers the `agon://` custom URL scheme on install so the OS can wake it for configuration updates.

This is the first client. Future clients could include agents for other platforms, mobile apps, or console companions — anything that can call the API.

## Tech stack

Every choice below was made deliberately. The reason is part of the decision.

### API — Go

Go is used for the API server. `net/http` from the standard library handles routing — no web framework. A single statically compiled binary with no runtime dependency is the deployment artifact. Idle memory is around 15 MB, which comfortably fits the smallest available VPS tier.

Go was chosen over Kotlin/JVM (too much memory at idle for a cheap VPS), Python (slower, two languages needed anyway once the agent language is decided), Node/TypeScript (same problem), and PHP (no meaningful advantage). C# was considered but Go produces a self-contained binary with no runtime required on the server, which simplifies deployment and keeps the VPS footprint minimal.

### Windows tray agent — C#, .NET 9, Velopack

C# is used for the Windows tray agent. .NET 9 provides first-class Windows API access for process enumeration, system tray integration, OS notifications, and custom URL scheme registration. Velopack handles installation, auto-updates via GitHub Releases, and clean uninstall — all things a proper Windows desktop application needs.

Go was considered and ruled out: it produces a smaller binary but the Windows desktop integration surface (tray, notifications, installer, URL scheme) requires significantly more work in Go than in C#. The developer has deep C# experience from other projects, which matters for a component that needs to work reliably on end-user machines.

The agent has no UI of its own. Any configuration or session review opens the web app in the default browser.

### Web frontend — React, TypeScript, Vite, pnpm

React is used for the web frontend. TypeScript strict mode throughout, no `any`. Vite is the build tool. pnpm is the package manager. Node 22 is pinned via `.node-version` for fnm.

React was chosen over SvelteKit and other options primarily for contributor accessibility — it has the largest frontend developer community by a significant margin, the most tutorials, and the most available help. SvelteKit would be faster to write but React wins on the ability to attract contributors to an open source project. Next.js was ruled out — server-side rendering adds complexity that a logged-in tool with no SEO requirements does not need. A plain SPA is sufficient.

The frontend is deployed to Cloudflare Pages. Static assets are served from Cloudflare's edge globally, free of charge, with automatic deploys on every push to `main` and preview URLs per pull request. The Go binary serves only API routes — it has no responsibility for static files.

### Database — Supabase, Postgres

Supabase provides managed Postgres. The `pg_cron` extension runs the nightly eviction job for expired unconfirmed sessions. The application connects via a standard Postgres connection string and has no knowledge of the provider.

### Authentication — Bluesky OAuth

Bluesky OAuth is the only authentication method. Agōn is an AT Proto application — a Bluesky account and AT Proto DID are required regardless of how a user logs in, so adding Google, GitHub, or any other provider would only delay an inevitable linking step. A Bluesky account is a hard requirement, stated clearly in the README.

### AT Proto / Bluesky PDS

Bluesky's hosted PDS is used rather than a self-hosted one. User identity and confirmed session record storage are Bluesky's infrastructure cost, not ours.

## Why AT Proto

Sessions are the user's data, not ours. AT Proto gives users a portable identity and portable records — if Agōn shuts down, the data does not disappear. It also reduces our cold start problem: users can bootstrap their social graph from existing Bluesky follows rather than finding each other from scratch.

## Why the frontend and backend are separate deployments

The React SPA is static — HTML, CSS, and JavaScript with no server-side rendering. Cloudflare Pages serves it from the edge for free with automatic deploys. There is no reason to serve static files from the Go binary or pay for a server to do what a CDN does better for free. The Go binary is responsible only for API routes, which makes it simpler.

## Why one Go binary for the API

The scope does not justify a gateway, a reverse proxy, or multiple services. Go's `net/http` handles everything needed. One binary, one process, one thing to monitor and deploy.

## Game detection

The Windows tray agent detects games by watching for new processes that load a graphics API — DirectX, OpenGL, or Vulkan. Specifically it looks for `d3d9.dll`, `d3d10.dll`, `d3d11.dll`, `d3d12.dll`, `opengl32.dll`, or `vulkan-1.dll` in the process's loaded modules. This covers virtually every PC game regardless of store or launcher.

When a matching process appears, the agent captures the window title and sends it to the API for fuzzy matching against IGDB. The match is a suggestion, not a fact — the user confirms or corrects it.

We do not maintain an executable-to-game database. The window title approach works without one, is transparent to users and contributors, and covers games from any store or no store.

## Session lifecycle

```
active      game is running, client is sending heartbeats every 10 minutes
ended       game process closed (or user manually ended), IGDB match attempted, notification fired
confirmed   user reviewed and approved, published to AT Proto feed
discarded   user dismissed
```

Sessions only publish to AT Proto on confirmation. Unconfirmed sessions are private, stored in Postgres, and visible in the web app's inbox. Unconfirmed sessions are automatically evicted after 7 days — they are short-lived scaffolding, not permanent records.

Heartbeats serve two purposes: accurate duration if the machine crashes, and liveness detection. Sessions with no heartbeat for 15 minutes are auto-closed.

## AT Proto records are fully denormalised

When a session is confirmed, the AT Proto record contains all game metadata — title, cover art URL, genres, IGDB ID — baked in at publish time. A friend's feed never needs to query the API or IGDB to render a session card. The record is self-contained and portable.

## Session record schema

The AT Proto session record (`app.agon.session`) contains:

- Game title, cover art URL, genres, IGDB ID — baked in at publish time
- Duration in seconds
- Start and end timestamps
- Optional `log` — the owner's narrative note, written at confirmation time

The `log` field is defined in the lexicon from the start. Records published without a log will permanently lack one — there is no retrofit path once a record is on the PDS. The log is immutable after publish; it is not a comment and cannot be edited post-confirmation.

## Likes

Likes are AT Proto records that reference the session's AT URI. They are separate records in the liker's repo — the original session record is never modified. Sessions published today are already likeable when the like feature ships; no migration is needed.

Likes are **not surfaced as feed items** in the Realm and do **not** trigger an Echo notification — they are too frequent and low-signal for a focused gaming audience. The like button appears inline on each Realm feed card (heart icon + count) so users can like without navigating away. The full liked-by list (avatars, expandable) lives in the session detail only.

## Log and comments

Two distinct concepts for text attached to a journey:

**Log** — the session owner's narrative, written once at confirmation time. It is a field on the session record (`app.agon.session.log`). Shown in the Realm feed card and in the session detail. Only the owner has a log; it cannot be edited after publish.

**Comments** — text written by any player (including the session owner) after the session is published. Separate AT Proto records (`app.agon.comment`) that reference the session URI. Shown in the session detail only — never in the Realm feed. Comments are flat and chronological — no threading, no hierarchy, no reply-to chains. Comments cannot be liked. A new comment on your session by another player triggers an Echo notification; your own comments on your own session do not.

## Navigation structure

The shell has a fixed sidebar on the left and a top bar across the top.

**Sidebar** — primary navigation, five items:

| Item | Route | Purpose |
|------|-------|---------|
| Realm | `/` | Social feed — sessions from people you follow |
| Journeys | `/journeys` | Your own sessions — confirmed, pending, history |
| Players | `/players` | Social graph — who you follow, who follows you |
| Hero | `/hero` | Your profile and stats |
| Settings | `/settings` | App preferences and account |

**TopBar** — secondary controls, right-aligned:

| Item | Purpose |
|------|---------|
| Echoes bell | Notifications — always visible, badge when unread |
| Theme toggle | Light / dark mode |
| Hero avatar | Quick link to `/hero` |

The Echoes bell is always present in the TopBar regardless of route. It navigates to `/echoes` — a dedicated page listing notifications. The bell highlights (same primary colour as active sidebar items) when on that route, and shows an unread badge when there are unseen notifications.

## Echoes

Echoes are in-app notifications. They surface in the TopBar bell icon, which shows a badge when there are unread items. Clicking the bell opens a panel listing recent Echoes without navigating away from the current page.

Events that produce an Echo:
- A new comment on one of your sessions by another player
- A new follower

Events that do **not** produce an Echo:
- Likes — too frequent and low-signal for a focused gaming audience
- Your own comments on your own session

Echoes are stored server-side (Postgres) per user DID so they persist across devices and sessions. They are marked read when the user visits `/echoes`.

## Realm feed

The Realm is the home feed. It shows confirmed sessions from people you follow, reverse chronological. Each session card displays:

- Player avatar, display name, Bluesky handle
- Game cover art (square thumbnail, left-aligned)
- Game title and genre chips
- Duration and relative timestamp ("3h 14m · 2 hours ago")
- Like button (heart icon + count, inline) — toggleable without leaving the feed
- Log text if the session has a `log` value

The only action on the card is the like. There are no comments or reply actions on the card. Likes as feed items ("X liked Y's session") are not shown — the feed answers only "what did people I follow play?"

## Session detail

Tapping a session card opens the session detail at `/journey/:id`. It shows:

- Full session metadata and log
- Like button — the only place the like action is exposed
- Liked-by avatars — a subset shown inline, expandable to the full list
- Comments — flat, chronological, posted by any player including the owner; not likeable
- **Friends on this journey** — people you follow who have also played this game, ordered by most recent session, up to 20
- **Others on this journey** — players outside your follow graph who have played this game, ordered by most recent session, up to 20

The two journey sections drive discovery and engagement: seeing a friend on the same game invites a like on their session; seeing a stranger invites a follow.

## Game sessions index

Querying AT Proto for "all sessions with game X" across the network is impractical — AT Proto has no cross-PDS index for arbitrary record fields. Instead, the API server maintains a lightweight Postgres index:

```
game_sessions_index(igdb_id, user_did, session_uri, played_at)
```

A row is written when a session is confirmed and published. The session detail query is a single cheap Postgres read: top 20 rows by `played_at` for the given `igdb_id`. The AT Proto record at `session_uri` provides all display data.

Limitation: only sessions confirmed through this API server are indexed. Sessions from other Agōn instances would not appear. This is acceptable for MVP — federation is a future concern.

## IGDB

IGDB (owned by Twitch) is free for non-commercial use and is the most comprehensive game database available. We use it for game metadata, cover art, genres, and similar game relationships. The Twitch client secret lives server-side only — the frontend and clients never touch it.

IGDB responses are cached in Postgres with a TTL. This cache is server-side infrastructure to stay within IGDB rate limits during detection and confirmation. Clients read game metadata from the denormalised AT Proto records instead.

## Exclusion list

Users can mark specific executables as non-games so the agent ignores them. Exclusions are stored in Postgres per user DID. The agent fetches the full exclusion list from the API on startup and again each time a new process is detected, before deciding whether to create a session. Game launches are infrequent events so this is negligible traffic. No persistent connection, no polling, no push mechanism needed — exclusions are only relevant at the moment of detection.

## Custom URL scheme

The agent registers `agon://` as a custom URL scheme on install via Velopack. Its sole purpose is the OAuth callback: after the user completes Bluesky OAuth in the browser, the web app redirects to `agon://auth?token=...`, the OS routes this to the running agent, and the agent stores the token. This is the standard pattern for desktop OAuth flows.

## Data boundaries

```
AT Proto      confirmed sessions — fully denormalised, permanent, user-owned
              likes — separate records referencing session AT URIs
              social graph, identity, feed

Postgres      unconfirmed sessions — evicted after 7 days
              exe exclusions — per user DID, permanent until removed
              game cache — server-side IGDB responses with TTL
              game_sessions_index — igdb_id / user_did / session_uri / played_at
                                    written on confirm, used for "on this journey" queries
              echoes — per user DID, new comment / new follower events, marked read on open

localStorage  UI preferences only
```

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. The C# agent uses xUnit. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.

## What we are not building yet

- Tray agent for platforms other than Windows
- Console session detection (PSN / Xbox APIs are a future consideration)
- The language-based recommendation engine (requires session note data at scale)
- Self-hosted PDS

## Rate limiting

Rate limiting is built into the API server from the start, not added later as a hardening step.

The reason is not primarily abuse prevention — it is predictability. A misconfigured cache, a retry loop with no backoff, or a bad deployment can generate runaway internal traffic just as effectively as a malicious actor. The rate limits define what this infrastructure is sized for. Anything above that ceiling gets a `429 Too Many Requests` immediately. The server does not queue, does not slow down, and does not accumulate cost — it refuses.

This gives the "outage not bill" failure mode deliberately: under extreme load the API degrades cleanly rather than saturating downstream dependencies or generating unexpected charges.

Two layers enforce this:

**Cloudflare (per-IP)** — 100 requests per IP per minute, configured in the Cloudflare dashboard. This is the outermost layer; it acts before any request reaches the VPS.

**Go API (global token bucket)** — a global limiter caps total throughput at 200 req/s regardless of source. Implemented with `golang.org/x/time/rate`. The limit is a configuration value read from `RATE_LIMIT_RPS` at startup so it can be adjusted without a rebuild.

The IGDB proxy enforces a separate sub-limit of 4 requests/second upstream — matching IGDB's documented rate limit — independent of how many inbound requests are in flight.

These numbers reflect side-project scale and the real request patterns of a social feed app: a handful of calls on page load, heartbeats every 10 minutes per agent session. They are not arbitrary. Revisit them when there is real traffic data.
