# Design

Architecture decisions and the reasoning behind them. This is not a tutorial and not a reference — the code is the reference. Decisions live here so they are not relitigated.

## What we are building

A social feed for gaming sessions, built on AT Proto. The core loop: a tray agent detects when you are playing a game and for how long, proposes a session record when you stop, you confirm or discard it, confirmed sessions publish to your AT Proto feed and become visible to followers.

Discovery and recommendations are a secondary goal, enabled by the session data that accumulates over time.

## Components

Three deployable things:

**API server** — a single Go binary. Handles all backend logic, serves the React frontend as embedded static files, proxies IGDB with an in-process cache. One process, one deployment.

**Tray agent** — a small Go binary that runs on the user's machine. Watches for games, creates and heartbeats sessions, fires an OS notification with a URL when a game closes. Has no UI beyond a system tray icon and a quit menu item.

**Web frontend** — a React SPA embedded into the API server binary at build time. Handles session confirmation, the social feed, game search, and personal stats.

## Why AT Proto

Sessions are the user's data, not ours. AT Proto gives users a portable identity and portable records — if Agōn shuts down, the data does not disappear. It also reduces our cold start problem: users can bootstrap their social graph from existing Bluesky follows rather than finding each other from scratch.

We use Bluesky's hosted PDS rather than running our own. That means user identity and session record storage are Bluesky's infrastructure cost, not ours. We index the AT Proto firehose for feed generation.

## Why one Go binary for the backend

The scope does not justify a gateway, a reverse proxy, or separate frontend hosting. Go's `net/http` serves static files competently. Embedding the React build with `embed.FS` means one artifact to deploy and one thing to monitor. This decision is revisited if the frontend and backend teams need independent deploy cycles, which is not a concern right now.

Cloudflare sits in front for DNS, SSL termination, and static asset caching. We do not use Cloudflare Workers — the IGDB proxy lives in the Go binary with an in-memory TTL cache.

## Game detection

The tray agent detects games by watching for new processes that load a graphics API — DirectX, OpenGL, or Vulkan. Specifically it looks for `d3d9.dll`, `d3d10.dll`, `d3d11.dll`, `d3d12.dll`, `opengl32.dll`, or `vulkan-1.dll` in the process's loaded modules. This covers virtually every PC game regardless of store or launcher.

When a matching process appears, the agent captures the window title and attempts a fuzzy match against IGDB. The match is a suggestion, not a fact — the user confirms or corrects it.

We do not maintain an executable-to-game database. The window title approach works without one and is transparent to users and contributors.

## Session lifecycle

```
active      game is running, agent is sending heartbeats every 10 minutes
ended       game process closed, IGDB match attempted, notification fired
confirmed   user reviewed and approved, published to AT Proto feed
discarded   user dismissed
```

Sessions only publish to AT Proto on confirmation. Unconfirmed sessions are private, stored in Postgres, and visible in the web app's inbox.

Heartbeats serve two purposes: accurate duration if the machine crashes, and liveness detection. Sessions with no heartbeat for 15 minutes are auto-closed.

## IGDB

IGDB (owned by Twitch) is free for non-commercial use and is the most comprehensive game database available. We use it for game metadata, cover art, genres, and similar game relationships. The Twitch client secret lives server-side only — the frontend never touches it. Responses are cached in-process with a TTL to stay within rate limits.

## Hosting

Fly.io for the Go binary. Supabase for Postgres. Cloudflare for DNS and proxying. All have free tiers sufficient for a side project at low traffic.

## Testing

Tests are written from the start. Go packages have unit tests alongside the code they test. Integration tests covering the API live in a dedicated test package. The React frontend uses Vitest. We do not aim for coverage targets — we test behaviour that would be painful to debug manually.

## What we are not building yet

- Native mobile apps
- Console session detection (PSN / Xbox APIs are a future consideration)
- The language-based recommendation engine (requires session note data at scale)
- Self-hosted PDS
