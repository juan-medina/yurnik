# Yurnik

Yurnik is a free, open-source social network for your gaming life. Log what you play, see what people you follow are playing, discover games through the people you trust.

<p align="center">
<a href="https://yurnik.social">
  <img src="web/public/logo.png" alt="Yurnik hero image" width="150"><br/>
  https://yurnik.social
</a>
</p> 

## What it is

- **Automatic journey detection** — a lightweight tray agent watches for running games using graphics API detection, no manual logging required
- **Social feed** — see what people you follow have been playing in real time
- **Game discovery** — recommendations based on your play history and your network's

## What it is not

- A game launcher
- A library manager

## Status

Beta Testing

## Architecture

Three components, one Postgres database. The code is the reference for details — this is just enough to orient yourself.

```
┌────────────────────────┐
│      Web (React)       │
│    Tray agent (C#)     │
└────────────┬───────────┘
             │ HTTPS / JSON
             ▼
┌────────────┴───────────┐
│        API (Go)        │
│   api.yurnik.social    │
└────────────┬───────────┘
             │
             ▼
┌────────────┴───────────┐
│        Postgres        │
└────────────────────────┘
```

The web app and the tray agent are both clients of the same API — they call it independently over HTTPS/JSON, the agent is never a dependency of the web app or vice versa.

- **`web/`** — the React SPA, deployed to Cloudflare Workers. Everything a user does — log in, confirm or browse journeys, follow players, search games, manage exclusions — goes through this. It is fully functional with no client installed.
- **`api/`** — a single Go binary, the only thing that talks to Postgres, Discord and IGDB. It serves all `/api/v1` routes, handles login and session issuing, proxies and caches IGDB lookups, and holds pending (unconfirmed) journeys until the user acts on them or they're evicted.
- **`agent/`** — an optional Windows tray app (C#). It watches for games starting/stopping (via graphics API detection), calls the API directly to create pending journeys, and notifies the user when a game closes so they can confirm it via the web app. It has no UI beyond the tray icon and receives its session token from the web app via the `yurnik://` URL scheme.

### Login and sessions

Login is Discord OAuth only (authorization code grant + PKCE), handled entirely server-side:

1. The web app hits `/auth/init`, the API redirects to Discord.
2. The user approves on Discord and is redirected back with a code.
3. The API exchanges the code, looks up or creates the user, and issues a signed session JWT.
4. The web app exchanges that for the session token via `/auth/session` and sends it as `Authorization: Bearer <token>` on every request after that.

There's no server-side session table — the JWT itself, signed with the API's session key (`make gen-keys`), is the session. The agent gets its own copy of this token via the `yurnik://auth?token=…` URL scheme after the user logs in on the web app. Sessions last 7 days; the agent periodically calls `/api/v1/agent/heartbeat` to renew its token before it expires, so a long-running agent stays signed in without user action.

See [docs/DESIGN.md](docs/DESIGN.md) for the full picture (data model, journeys, social graph, etc.) and [docs/API.md](docs/API.md) for the endpoint reference.

## Development

Requirements: Go 1.25+, Node 22 (via fnm), pnpm, .Net 9

### 1. Set up your environment

```sh
make setup
```

Installs nvm, pnpm, Go, .NET and Postgres (Windows only — runs `scripts/setup.ps1`, requires winget and admin privileges).

### 2. Set up the database

```sh
make db-start   # start the local Postgres server
make db-init    # create the yurnik database and roles (first time, or to reset to a clean slate)
make db-migrate # apply schema migrations
```

`make db-init` only creates the database, roles and grants — it does not create any tables. Always run `make db-migrate` afterwards to bring the schema up to date. Run `db-migrate` again any time you pull changes that add a new migration.

`make db-stop` stops the local Postgres server again.

### 3. Run the app

Each component runs in its own terminal:

```sh
make run-api    # Go API server
make run-web    # React dev server
make run-agent  # tray agent
make run-maintenance # daily data cleanup job (run locally to test)
```

### Testing

```sh
make test                        # run every test suite below
make test-api                    # Go unit tests for API
make test-maintenance            # Go unit tests for maintenance binary
make test-agent                  # .NET/xUnit tests (agent/)
make smoke-test-agent            # smoke test for tray agent
make test-web                    # Vitest tests (web/)
make test-integration            # run all integration tests below
make test-integration-api        # API tests against a real Postgres instance
make test-integration-maintenance # Maintenance tests against a real Postgres instance
```

### Linting

```sh
make lint   # lint the web frontend
```

### Security & Vulnerability Audits

```sh
make audit               # run all vulnerability checks below
make audit-api           # scan API Go dependencies (govulncheck)
make audit-maintenance   # scan Maintenance Go dependencies (govulncheck)
make audit-web           # scan web production dependencies (pnpm audit --prod)
make audit-agent         # scan agent .NET packages for vulnerabilities
```

### Dependency Management

```sh
make tidy   # run go mod tidy on api/
```

### Building

```sh
make build             # build api, maintenance, web and agent
make build-api         # Go API binary
make build-maintenance # Go maintenance binary
make build-web         # production frontend bundle
make build-agent       # .NET release build
```

### Other

```sh
make gen-keys # generate a session signing key
```

`make gen-keys` is used both locally (so the API has a key to sign session tokens with in dev) and once on the production server to generate the key referenced by `SESSION_KEY_FILE`.

```sh
make deploy-api    # deploy the API to the production server
make deploy-web    # build and deploy the web frontend to Cloudflare Workers
make release-agent # tag and publish a new agent release
```

`deploy-api` and `deploy-web` are not normally run by hand — they are invoked by CI (see below). `deploy-api` does require the production environment (SSH access to the VPS) and `deploy-web` requires Cloudflare API credentials, so running either locally isn't meaningful anyway.

`release-agent` (`agent/release.ps1`) is the opposite: it's a local helper run by hand, not by CI. It reads the version from `agent/version.props`, creates and pushes a `vX.Y.Z` git tag, then uses `gh release create` (with `agent/release-notes.md`) to create the GitHub release. Pushing that tag is what triggers the Release Agent workflow (see below), which builds the actual agent binary and uploads it to the release `release-agent` just created. Requires `git` and the GitHub CLI (`gh`) locally, a clean working tree, and no unpushed commits.

```sh
# Usage: make export-user USER=<handle-or-uuid> [OUT=<output-file>]
make export-user USER=somehandle
```

Produces a single JSON file with all data Yurnik holds about one user (handle or UUID), for fulfilling GDPR right-of-access requests. Read-only — no writes, no HTTP endpoint. Defaults to printing to stdout; pass `OUT=<file>` to write to a file instead.

## CI/CD

Two GitHub Actions workflows:

- **Deploy** (`.github/workflows/deploy.yml`) — runs on every push to `main`. Runs the unit tests (API, Maintenance, web, agent), throwaway-Postgres integration tests (API, Maintenance), and security audits (`audit-api`, `audit-maintenance`, `audit-web`, `audit-agent`) in parallel. If all tests and audits pass, it builds the artifacts, then SSHes into the production VPS to deploy the API/Maintenance services via `make deploy-api` / `make deploy-maintenance`, and finally deploys the frontend to Cloudflare Workers via `make deploy-web`.
- **Release Agent** (`.github/workflows/release-agent.yml`) — runs when a `vX.Y.Z` tag is pushed. Runs the agent's xUnit tests, publishes a self-contained win-x64 build, packages it with Velopack (`vpk`), and publishes it as a GitHub release that `release-agent` produces — this is how end users get agent updates.

## License

MIT — see [LICENSE](LICENSE)

Copyright (c) 2026 Juan Medina
