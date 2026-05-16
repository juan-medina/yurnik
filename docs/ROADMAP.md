# Roadmap

This document tracks what has been done, what is in progress, and what is planned. It is updated as work completes. It is not a promise of dates or scope — it is a record of intent and progress.

For architecture decisions see [`docs/DESIGN.md`](docs/DESIGN.md). For deployment see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Done

### Repository scaffold
Initial monorepo structure, tooling config, and documentation baseline.

- Monorepo layout: `api/`, `agent/`, `web/`, `docs/`, `scripts/`
- Go module at `github.com/juan-medina/agon`, Go 1.23
- `.editorconfig`, `.gitattributes`, `.gitignore`, `.node-version` (Node 22)
- `Makefile` with `api`, `agent`, `web`, `test`, `lint`, `build` targets
- `LICENSE` (MIT)
- `README.md` — project overview and quick-start
- `CLAUDE.md` — coding conventions for Claude Code
- `.github/copilot-instructions.md` — coding conventions for Copilot
- `docs/DESIGN.md` — architecture decisions and reasoning
- `docs/DEPLOYMENT.md` — infrastructure topology and operational decisions
- Windows dev setup scripts: `scripts/setup.ps1`, `scripts/db-init.ps1`, `scripts/db-init.sql`, `scripts/db-start.ps1`, `scripts/db-stop.ps1`

### 1 — Frontend shell
Layout, routing, and design system foundations. No data, no API calls — structure and navigation only.

- [x] Vite + React 18 + TypeScript project in `web/` (`pnpm`, Node 22)
- [x] React Router v7 — nested layout route with `createBrowserRouter`
- [x] Shell layout: left sidebar with nav links, top bar with theme toggle and avatar placeholder
- [x] Design tokens: Tailwind v4 CSS variables, violet accent, dark mode default with light mode toggle
- [x] Placeholder pages: Realm, Journeys, Players, Hero, Settings
- [x] Echoes page (`/echoes`) and bell NavLink in TopBar with unread badge support
- [x] Vitest + React Testing Library wired up — 2 tests passing

---

## In Progress

### 2 — Frontend with mock data
Full UI and user flows built with inline mock data. No backend required at this stage.

**Realm feed**
- [x] Session cards: cover art, player, game title, genres, duration, timestamp, log, inline like toggle
- [x] Cards navigate to `/journey/:id`

**Journey detail (`/journey/:id`)**
- [x] Session header: back navigation, player info, cover art, game metadata, log as blockquote
- [x] Likes: inline toggle, liked-by avatar stack, expandable count
- [x] "On this journey": Friends section (follow graph) and Others section (discovery + Follow toggle)
- [x] Comments: flat chronological list, comment input, Post button

**Remaining**
- [ ] Journeys page — your own sessions: confirmed history and pending confirmation inbox
- [ ] Session confirmation flow — review game match, duration, write log, confirm or discard
- [ ] Players page — who you follow, who follows you
- [ ] Hero page — your profile, confirmed session history, stats
- [ ] Echoes page — notification list (new comment, new follower)
- [ ] Game search — IGDB-backed search UI (mocked)
- [ ] Exclusion management — add/remove executable exclusions
- [ ] Vitest tests for all flows

---

## Planned

Work is sequenced intentionally. Each phase produces something usable before the next begins.

### 3 — API contracts
HTTP API shapes defined and documented before any implementation is written. The frontend mock layer and the Go implementation will both be built against these contracts.

- Request and response types for every endpoint the frontend needs
- Documented in `docs/API.md`
- Error shape and status code conventions established

### 4 — API: authentication
Bluesky OAuth wired end-to-end. The most external-dependency-heavy slice; doing it before the rest of the API means everything else can assume working auth.

- Bluesky OAuth flow: initiate, callback, token storage
- Session middleware: authenticate requests, attach DID to context
- Token refresh
- Integration tests

### 5 — API: full implementation
Remaining API endpoints implemented against the contracts from phase 2, with the frontend from phase 3 consuming them for real.

- Session lifecycle: create, heartbeat, end, confirm, discard
- Feed: fetch confirmed sessions from followed AT Proto DIDs
- IGDB proxy: game search and metadata, cached in Postgres
- Exclusion list: per-user CRUD
- AT Proto publishing: confirmed session → lexicon record on the user's PDS
- Database migrations
- Integration tests for all endpoints

### 6 — Agent
Windows tray agent. Depends on the API being complete enough to receive sessions.

- Process watcher: graphics API DLL detection (`d3d9/10/11/12`, `opengl32`, `vulkan-1`)
- Window title capture and IGDB fuzzy match via API
- Session lifecycle: create on detection, heartbeat every 10 minutes, end on process close
- OS notification with `agon://` URL on session end
- `agon://auth` URL scheme handler for OAuth callback
- Exclusion list fetch on startup and on each new detection
- Velopack installer, auto-update via GitHub Releases
- xUnit tests for detection and lifecycle logic

---

## Future considerations
Things not being built yet. Listed so they are not forgotten and not accidentally built too early.

- Tray agent for macOS and Linux
- Console session detection (PSN / Xbox APIs)
- Language-based game recommendations (requires session note data at scale)
- Self-hosted AT Proto PDS support
- Mobile app
