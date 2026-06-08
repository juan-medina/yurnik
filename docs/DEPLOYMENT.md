# Deployment

Operational decisions and the reasoning behind them. Architecture decisions live in `DESIGN.md`. Technology and stack choices live in `DECISIONS.md`. This document covers how to run the thing, not how it is built.

## Topology

```
Cloudflare Pages          React SPA — static assets, global CDN, free
    │
    │  API calls (api.yurnik.gg)
    ▼
Cloudflare proxy          DNS, SSL termination, DDoS absorption, rate limiting
    │
    ▼
Hetzner VPS               Go API binary + Postgres on the same instance
```

## Frontend — Cloudflare Pages

The React SPA is deployed directly from Git. Cloudflare Pages rebuilds and deploys on every push to `main`. Pull requests get preview URLs automatically. Static assets are served from Cloudflare's edge globally at no bandwidth cost.

No server is involved in serving the frontend. The SPA communicates with the API at `api.yurnik.gg`.

## API and database — Hetzner VPS

A fixed-price VPS hosts both the Go API binary and Postgres on the same instance. The two services share the machine — no network hop between the API and the database, and no separate managed database cost.

A shared-CPU instance with 4 GB RAM handles both comfortably at side-project scale. When included bandwidth is exceeded Hetzner charges €1/TB overage rather than cutting service — set a traffic alert in the Hetzner dashboard to warn before the included allowance is reached.

Pay-as-you-go platforms were ruled out because they have no hard billing ceiling. A compromised server, a bug causing runaway requests, or a sustained spike can generate a large bill before you notice. Fixed-price VPS means the worst case is a slow or unresponsive server, not an unexpected invoice.

## Database — Postgres

Postgres runs as a systemd service on the same VPS as the Go binary. The `pg_cron` extension handles the nightly eviction job for expired unconfirmed journeys — enable it once after install:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Backups run via a daily cron job on the VPS:

```sh
pg_dump $DATABASE_URL | gzip > /var/backups/yurnik/$(date +%Y%m%d).sql.gz
```

Retain at least 7 days of backups.

## Rate limiting

Rate limiting exists for two distinct reasons, both important: protecting against external abuse, and protecting against our own bugs. A misconfigured cache, a retry loop in the agent, or a bad deployment can hammer the API from the inside just as effectively as a malicious actor from the outside. The limits below are a contract with ourselves about what this infrastructure is sized for.

### Cloudflare — per-IP

Configured in the Cloudflare dashboard under Security → WAF → Rate Limiting Rules:

- **`/api/*`** — 100 requests per IP per minute. Stops a single bad actor or a buggy agent running on one machine from saturating the server.

This is the outermost layer. It acts before any request reaches Hetzner.

### Go API — global

A global token bucket limiter in the Go server caps total throughput regardless of how many IPs are making requests. This is the ceiling on what the system will ever serve.

Configured via `RATE_LIMIT_RPS` at startup. Requests over the limit receive `429 Too Many Requests` immediately — no queuing, no retry.

### Agent — exponential backoff

The agent must never send requests in a tight loop. Heartbeats run every 10 minutes. Any retry on API failure must use exponential backoff with a cap. Unbounded retry loops are bugs.

## Secrets

| Secret | Where |
|--------|-------|
| `DATABASE_URL` | Hetzner VPS environment |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | Hetzner VPS environment |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Hetzner VPS environment |
| `SESSION_KEY_FILE` | Hetzner VPS, generated once with `make gen-keys` |

Secrets are never committed to the repository. `.env.example` lists all required variables with empty values.

## Database migrations

Two separate steps, both exposed as `make` targets:

- **`make db-init`** — drops and recreates the `yurnik` database and the `yurnik_admin` / `yurnik_api` roles (`scripts/db-init.sql`). Schema-free — just the database, roles, and grants. Used in dev to reset to a clean slate, and once on a fresh production box before the first deploy.
- **`make db-migrate`** — applies versioned migrations (`api/internal/migrations`, embedded in the `api/cmd/migrate` binary, run via `golang-migrate`) to bring whatever schema state exists up to the latest. Connects as `yurnik_admin` via `DATABASE_ADMIN_URL` since applying DDL requires admin rights. Idempotent — re-running it when the schema is already current is a no-op.

Dev flow: `make db-init` then `make db-migrate`.

Migrations are plain numbered SQL files (`000N_description.up.sql` / `.down.sql`). Once a migration has shipped it is never edited — changes are new numbered files. `golang-migrate` runs each migration in a transaction and records the applied version in `schema_migrations`; a failed migration rolls back cleanly and leaves the schema at the last good version.

### Deploy sequencing

Migrations run **after the service is stopped** and **before the new binary is swapped in**:

```
1. Build the new binary to a temp path
2. systemctl stop yurnik
3. Run migrations (make db-migrate / cmd/migrate up)
4. Swap the binary into place
5. systemctl start yurnik
```

This guarantees a binary never runs against a schema it wasn't built for — no old-binary-vs-new-schema or new-binary-vs-old-schema window. The tradeoff is a short downtime during deploy, acceptable for a side project at this scale, and it removes the need for migrations to stay backward-compatible with the previous release.

If the migration step fails, the script restarts the **old** binary — the schema is left at the last successfully-applied version (transactional, see above), so the old binary keeps working and the deploy fails loudly instead of leaving the service down.

### Writing a migration

1. Add `000N_description.up.sql` and `.down.sql` to `api/internal/migrations`.
2. Run `make db-migrate` locally against the dev database to confirm it applies (and that the down migration reverses it cleanly).
3. Update Go code/queries and tests to match the new shape.
4. Push — CI applies the migration against a fresh database as part of the integration test job, then the deploy pipeline applies it to production.

## Process management

The Go binary runs as a systemd service on the Hetzner VPS. Systemd handles restarts on failure and starts the process on boot.

A minimal service file:

```ini
[Unit]
Description=Yurnik API
After=network.target

[Service]
EnvironmentFile=/etc/yurnik/env
ExecStart=/usr/local/bin/yurnik-api
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Deploy process

1. Push to `main`
2. GitHub Actions builds the Go binary
3. Binary is copied to the VPS via `scp` or `rsync`
4. Migrations run against the production database
5. systemd restarts the service

No containers, no orchestration. One binary, one process, one thing to restart.
