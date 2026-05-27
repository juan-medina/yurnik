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

Bluesky's hosted PDS is used rather than a self-hosted one. User identity and confirmed journey record storage are Bluesky's infrastructure cost, not ours.

## Why AT Proto

Journeys are the user's data, not ours. AT Proto gives users a portable identity and portable records — if Agōn shuts down, the data does not disappear.

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
confirmed   user reviewed and approved, published to AT Proto as app.agon.journey
discarded   user dismissed
```

Sessions only publish to AT Proto on confirmation. Unconfirmed sessions are private, stored in Postgres, and visible in the web app's inbox. Unconfirmed sessions are automatically evicted after 7 days — they are short-lived scaffolding, not permanent records.

Heartbeats serve two purposes: accurate duration if the machine crashes, and liveness detection. Sessions with no heartbeat for 15 minutes are auto-closed.

When a session reaches ended, the pending card shown to the user includes the raw detection metadata — the executable name and window title the agent captured — as secondary information. This gives the user enough context to judge whether the match is correct without opening anything else. If no IGDB match was found, the card shows "Unknown Game" and prompts the user to search. Three actions are available on the collapsed card: Confirm (proceeds to the log form), Discard (removes the session permanently), and Never detect this (available only when an executable is associated — adds the exe to the exclusion list and dismisses the card). The exclusion action shows an inline confirmation before committing.

When the user corrects a game match during confirmation, the confirmed exe → IGDB ID pairing is stored in exe_game_hints. On the next session from the same executable, the server checks this table before attempting fuzzy match, so the suggestion is correct immediately.

## AT Proto lexicon

All record types Agōn defines, in one place. These are the only things written to the user's AT Proto storage.

### `app.agon.journey`

A confirmed game session. Written when the user confirms a pending session or manually logs one. Never written without explicit user action.

Fields:
- `igdbId` — IGDB game ID
- `gameTitle` — game title, baked in at publish time
- `coverUrl` — cover art URL, baked in at publish time
- `genres` — genre list, baked in at publish time
- `durationSeconds` — session length
- `startedAt` — UTC timestamp
- `endedAt` — UTC timestamp
- `log` — optional owner narrative, written once at confirmation, immutable after publish

All game metadata is baked in at publish time. A friend's feed never needs to call IGDB or the API to render a journey card — the record is self-contained and portable. The `log` field is defined in the lexicon from the start; records published without a log will permanently lack one — there is no retrofit path once a record is on the PDS.

### `app.agon.player`

An Agōn follow. Written when a user follows another player on Agōn. Deleted when they unfollow. This is Agōn's own follow record — it is separate from Bluesky follows and does not affect the user's Bluesky feed or follower counts.

Fields:
- `subject` — DID of the player being followed
- `createdAt` — UTC timestamp

### `app.agon.like`

A like on a journey. Written into the liker's own AT Proto storage, referencing the journey by AT URI. The original journey record is never modified.

Fields:
- `subject` — AT URI of the journey being liked
- `createdAt` — UTC timestamp

### `app.agon.comment`

A comment on a journey. Written into the commenter's own AT Proto storage.

Fields:
- `subject` — AT URI of the journey being commented on
- `text` — comment body, 1–500 chars
- `createdAt` — UTC timestamp

## AT Proto records are fully denormalised

When a journey is confirmed, the AT Proto record contains all game metadata baked in at publish time. A friend's feed never needs to query the API or IGDB to render a journey card. The record is self-contained and portable.

## Social graph

Agōn maintains its own follow graph using `app.agon.player` records. Following someone on Agōn does not follow them on Bluesky and has no effect on either user's Bluesky feed or follower counts. The two graphs are independent.

This was a deliberate decision. Using Bluesky follows would mean that following a gamer on Agōn pollutes the user's Bluesky feed with gaming content they did not ask for there. Agōn follows are Agōn-scoped.

All follow and unfollow actions go through the Agōn API, which writes or deletes the `app.agon.player` record on the PDS and updates the local `players_index` table in Postgres simultaneously. Because every follow action is mediated by the API, the Postgres index is always current — no polling or firehose subscription is needed to keep it in sync.

The `players_index` table is the fast query path. It is a local mirror of what is on the PDS — if it were lost it could be rebuilt by replaying the PDS records. The source of truth is always AT Proto.

New follower echoes work because follows go through the API: when a `app.agon.player` record is written, the API creates the echo row for the followed player immediately.

## Likes

Likes are AT Proto records that reference the journey's AT URI. They are separate records in the liker's storage — the original journey record is never modified. Journeys published today are already likeable when the like feature ships; no migration is needed.

Likes are **not surfaced as feed items** in the Realm and do **not** trigger an Echo notification — they are too frequent and low-signal for a focused gaming audience. The like button appears inline on each Realm feed card (heart icon + count) so users can like without navigating away. The full liked-by list (avatars, expandable) lives in the journey detail only.

## Log and comments

Two distinct concepts for text attached to a journey:

**Log** — the journey owner's narrative, written once at confirmation time. It is a field on the journey record (`app.agon.journey.log`). Shown in the Realm feed card and in the journey detail. Only the owner has a log; it cannot be edited after publish.

**Comments** — text written by any player (including the journey owner) after the journey is published. Separate AT Proto records (`app.agon.comment`) that reference the journey URI. Shown in the journey detail only — never in the Realm feed. Comments are flat and chronological — no threading, no hierarchy, no reply-to chains. Comments cannot be liked. A new comment on your journey by another player triggers an Echo notification; your own comments on your own journey do not.

## Time and timestamps

Full timestamps (start and end in UTC) are stored on every journey record — required by the AT Proto schema and needed for feed ordering. The distinction between storage and display is intentional: the time of day a session was played is rarely meaningful to a gamer or their followers. What matters is the date.

**Display rule — journeys** — everywhere a journey's timestamp appears (Realm feed cards, profile journey cards, Journeys history), the label is date-level only:

| Session date | Label |
|---|---|
| Today | "Today" |
| Yesterday | "Yesterday" |
| Within the last 7 days | Weekday name — "Monday" |
| Older | Month and day — "May 15" (add year if different from the current year) |

No hours, no minutes, no "3 hours ago" for journeys. The time of day is stored but never shown.

**Display rule — comments** — comments are always recent and live inside a journey detail, so relative time ("23 minutes ago", "3 hours ago") is the right signal there. Comments use relative time throughout.

**Manual entry — when** — the confirmation form for a manually logged session asks when the player finished with two options only:

- **Just now** (default, pre-selected, no extra input) — end timestamp is the current time
- **Choose a date** — opens a date-only calendar picker; end timestamp is set to the end of the selected day

No intermediate options ("earlier today", "yesterday"). Two clear anchors are fast; ambiguous middle options require the user to categorise something that is already fuzzy.

**Ordering** — journeys are ordered by date (`played_at`) descending. Within the same date, journeys are ordered by record ID descending (creation order). A manually backdated journey lands in its date bucket without displacing journeys that were already there.

## Navigation structure

The shell has a fixed sidebar on the left and a top bar across the top.

**Sidebar** — primary navigation, five items:

| Item | Route | Purpose |
|------|-------|---------|
| Realm | `/` | Social feed — journeys from people you follow |
| Journeys | `/journeys` | Your own sessions — confirmed, pending, history |
| Players | `/players` | Game-centric discovery — browse who is playing what |
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
- A new comment on one of your journeys by another player
- A new follower on Agōn

Events that do **not** produce an Echo:
- Likes — too frequent and low-signal for a focused gaming audience
- Your own comments on your own journey

Echoes are stored server-side (Postgres) per user DID so they persist across devices and sessions. They are marked read when the user visits `/echoes`.

## Realm feed

The Realm is the home feed. It shows confirmed journeys from people you follow on Agōn, reverse chronological. The feed is backed by `journeys_index` — a single SQL query against the local Postgres index. No per-user AT Proto calls are made at feed request time.

Each journey card displays:

- Player avatar, display name, Bluesky handle
- Game cover art (square thumbnail, left-aligned)
- Game title and genre chips
- Duration and date label ("3h 14m · Today" or "3h 14m · Yesterday")
- Like button (heart icon + count, inline) — toggleable without leaving the feed
- Log text if the journey has a `log` value

The only action on the card is the like. There are no comments or reply actions on the card. Likes as feed items ("X liked Y's journey") are not shown — the feed answers only "what did people I follow play?"

## Players — game-centric discovery

The Players page (`/players`) is not a social graph view. It does not show a followers list or a following list — those live on the Hero and PlayerProfile pages. Players is a discovery surface: a feed of games with the players who recently played them beneath each one.

The design premise is that games are the shared context that makes player discovery meaningful. Showing a raw list of accounts to follow is low-signal. Showing "five people played Hollow Knight this week, here are their sessions" gives the visitor something to act on — they can recognise the game, see the log snippets, and decide whether to follow based on shared taste rather than a blank profile.

Each game card shows:
- Game cover art, title, and genre chips
- A row per recent journey: player avatar, name, duration, date, and log excerpt (truncated)
- Journey count for the game

The page is searchable by game title or genre, and filterable by genre chip. Search matches both game name and genre — typing "RPG" narrows to role-playing games across all entries.

Clicking a player row navigates to that player's profile. Clicking a journey row navigates to the journey detail. Both paths lead out of the discovery surface into social actions (follow, like, comment).

The data backing this page is the same `journeys_index` Postgres table used by the journey detail "on this journey" sections. The Players query is broader — all indexed journeys, not just those for a single game — ordered by `played_at` descending, grouped by `igdb_id`.

## Journey detail

Tapping a journey card opens the journey detail at `/journey/:id`. It shows:

- Full journey metadata and log
- Like button — the only place the like action is exposed
- Liked-by avatars — a subset shown inline, expandable to the full list
- Comments — flat, chronological, posted by any player including the owner; not likeable
- **Friends on this journey** — people you follow who have also played this game, ordered by most recent journey, up to 20
- **Others on this journey** — players outside your follow graph who have played this game, ordered by most recent journey, up to 20

The two journey sections drive discovery and engagement: seeing a friend on the same game invites a like on their journey; seeing a stranger invites a follow.

## Postgres as a rebuildable index

Postgres is not the source of truth for journeys or follows. AT Proto is. The Postgres tables that mirror AT Proto data are indexes — local caches optimised for fast queries that would be impractical to run against the distributed AT Proto network on every request.

If the index tables were lost, they could be rebuilt by replaying the relevant AT Proto records from the PDS. The index exists to serve queries cheaply, not to own data.

The only data that lives exclusively in Postgres and has no AT Proto counterpart:
- Unconfirmed sessions — private scaffolding, evicted after 7 days
- exe exclusions — per user, permanent until removed
- exe_game_hints — per user, built from confirmed corrections
- IGDB cache — server-side cache with TTL
- Echoes — notification rows, per user DID

## Journeys index

Querying AT Proto for "all journeys with game X" across the network is impractical — AT Proto has no cross-PDS index for arbitrary record fields. Instead, the API server maintains a lightweight Postgres index:

```
journeys_index(igdb_id, user_did, journey_uri, played_at)
```

A row is written when a journey is confirmed and published. The journey detail query is a single cheap Postgres read: top 20 rows by `played_at` for the given `igdb_id`. The AT Proto record at `journey_uri` provides all display data.

The Realm feed query joins `journeys_index` against `players_index` to return journeys from followed players — one SQL query, no per-user AT Proto calls.

Limitation: only journeys confirmed through this API server are indexed. Journeys from other Agōn instances would not appear. This is acceptable for MVP — federation is a future concern.

## Players index

```
players_index(follower_did, followee_did, created_at)
```

A row is written when a user follows another player on Agōn and deleted when they unfollow. This mirrors the `app.agon.player` records on AT Proto. Used to answer "who does this user follow" and "who follows this user" without querying the PDS.

## Likes index

```
likes_index(journey_uri, liker_did, like_uri, created_at)
```

A row is written when a user likes a journey and deleted when they unlike. This mirrors the `app.agon.like` records on AT Proto. Used to answer "how many likes does this journey have" and "who liked this journey" without querying each liker's PDS storage individually.

## Comments index

```
comments_index(journey_uri, commenter_did, comment_uri, text, created_at)
```

A row is written when a user posts a comment and deleted when they delete it. This mirrors the `app.agon.comment` records on AT Proto. Used to fetch all comments for a journey in chronological order without querying each commenter's PDS storage individually.

## The index pattern

Every AT Proto record type Agōn defines has the same problem: records are scattered across every user's own PDS storage with no central index. Querying "all likes for journey X" or "all comments for journey X" across the network on every request is impractical.

The solution is always the same: every action goes through the Agōn API, which writes to AT Proto and updates the corresponding Postgres index table in the same operation. The index is always current because the API is the only path for creating these records. No firehose, no polling, no background sync needed.

All four index tables are rebuildable from AT Proto if lost. They exist to serve queries cheaply, not to own data.

## IGDB

IGDB (owned by Twitch) is free for non-commercial use and is the most comprehensive game database available. We use it for game metadata, cover art, genres, and similar game relationships. The Twitch client secret lives server-side only — the frontend and clients never touch it.

IGDB responses are cached in Postgres with a TTL. This cache is server-side infrastructure to stay within IGDB rate limits during detection and confirmation. Clients read game metadata from the denormalised AT Proto records instead.

## Exclusion list

Users can mark specific executables as non-games so the agent ignores them. Exclusions are stored in Postgres per user DID. The agent fetches the full exclusion list from the API on startup and again each time a new process is detected, before deciding whether to create a session. Game launches are infrequent events so this is negligible traffic. No persistent connection, no polling, no push mechanism needed — exclusions are only relevant at the moment of detection.

The primary way to add an exclusion is directly from a pending session card — a "Never detect this" action is available inline whenever a session has an associated executable. Confirming it adds the exe to the exclusion list and dismisses the card without requiring navigation to Settings. Settings provides a management view to see and remove existing exclusions, but it is not the entry point for adding them.

## Custom URL scheme

The agent registers `agon://` as a custom URL scheme on install via Velopack. Its sole purpose is the OAuth callback: after the user completes Bluesky OAuth in the browser, the web app redirects to `agon://auth?token=...`, the OS routes this to the running agent, and the agent stores the token. This is the standard pattern for desktop OAuth flows.

## Data boundaries

```
AT Proto      app.agon.journey  — confirmed journeys, fully denormalised, permanent, user-owned
              app.agon.player   — Agōn follows, user-owned, independent of Bluesky follows
              app.agon.like     — likes, separate records referencing journey AT URIs
              app.agon.comment  — comments, separate records referencing journey AT URIs
              identity, auth

Postgres      unconfirmed sessions  — evicted after 7 days
              exe exclusions        — per user DID, permanent until removed
              exe_game_hints        — per user DID: exe_name → igdb_id, built automatically
                                      from confirmed corrections, used to skip fuzzy match
                                      on repeat detections
              IGDB cache            — server-side IGDB responses with TTL
              journeys_index        — igdb_id / user_did / journey_uri / played_at
                                      mirror of app.agon.journey records, rebuildable from AT Proto
              players_index         — follower_did / followee_did / created_at
                                      mirror of app.agon.player records, rebuildable from AT Proto
              likes_index           — journey_uri / liker_did / like_uri / created_at
                                      mirror of app.agon.like records, rebuildable from AT Proto
              comments_index        — journey_uri / commenter_did / comment_uri / text / created_at
                                      mirror of app.agon.comment records, rebuildable from AT Proto
              echoes                — per user DID, new comment / new follower events

localStorage  UI preferences only
```

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. The C# agent uses xUnit. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.

## What we are not building yet

- Tray agent for platforms other than Windows
- Console session detection (PSN / Xbox APIs are a future consideration)
- The language-based recommendation engine (requires session note data at scale)
- Self-hosted PDS
- Federation with other Agōn instances (journeys_index and players_index only cover this server's users)

## Rate limiting

Rate limiting is built into the API server from the start, not added later as a hardening step.

The reason is not primarily abuse prevention — it is predictability. A misconfigured cache, a retry loop with no backoff, or a bad deployment can generate runaway internal traffic just as effectively as a malicious actor. The rate limits define what this infrastructure is sized for. Anything above that ceiling gets a `429 Too Many Requests` immediately. The server does not queue, does not slow down, and does not accumulate cost — it refuses.

This gives the "outage not bill" failure mode deliberately: under extreme load the API degrades cleanly rather than saturating downstream dependencies or generating unexpected charges.

Two layers enforce this:

**Cloudflare (per-IP)** — 100 requests per IP per minute, configured in the Cloudflare dashboard. This is the outermost layer; it acts before any request reaches the VPS.

**Go API (global token bucket)** — a global limiter caps total throughput at 200 req/s regardless of source. Implemented with `golang.org/x/time/rate`. The limit is a configuration value read from `RATE_LIMIT_RPS` at startup so it can be adjusted without a rebuild.

The IGDB proxy enforces a separate sub-limit of 4 requests/second upstream — matching IGDB's documented rate limit — independent of how many inbound requests are in flight.

These numbers reflect side-project scale and the real request patterns of a social feed app: a handful of calls on page load, heartbeats every 10 minutes per agent session. They are not arbitrary. Revisit them when there is real traffic data.
