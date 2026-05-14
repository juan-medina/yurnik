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
              social graph, identity, feed

Postgres      unconfirmed sessions — evicted after 7 days
              exe exclusions — per user DID, permanent until removed
              game cache — server-side IGDB responses with TTL

localStorage  UI preferences only
```

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. The C# agent uses xUnit. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.

## What we are not building yet

- Tray agent for platforms other than Windows
- Console session detection (PSN / Xbox APIs are a future consideration)
- The language-based recommendation engine (requires session note data at scale)
- Self-hosted PDS
