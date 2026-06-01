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
Hetzner VPS               Single Go binary — API only, with application-level rate limiting
    │
    ▼
Supabase                  Managed Postgres
```

## Frontend — Cloudflare Pages

The React SPA is deployed directly from Git. Cloudflare Pages rebuilds and deploys on every push to `main`. Pull requests get preview URLs automatically. Static assets are served from Cloudflare's edge globally at no bandwidth cost.

No server is involved in serving the frontend. The SPA communicates with the API at `api.yurnik.gg`.

## API — Hetzner VPS

A fixed-price VPS with a known monthly cost that cannot increase regardless of traffic. When included bandwidth is exceeded Hetzner charges €1/TB overage rather than cutting service — set a traffic alert in the Hetzner dashboard to warn before the included allowance is reached. With Cloudflare absorbing inbound traffic and rate limiting enforced at both layers, hitting the outbound limit in normal operation is very unlikely.

A CX22 instance (2 vCPU, 4 GB RAM, 20 TB included traffic) at roughly €4–6/month is more than sufficient for a Go binary at side-project scale.

Pay-as-you-go platforms were ruled out because they have no hard billing ceiling. A compromised server, a bug causing runaway requests, or a sustained spike can generate a large bill before you notice. Fixed-price VPS means the worst case is a slow or unresponsive server, not an unexpected invoice. Rate limiting at both the Cloudflare and application layers ensures that even a legitimate traffic surge does not push the server beyond what it is sized for.

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
| Supabase connection string | Hetzner VPS environment |

Secrets are never committed to the repository. `.env.example` lists all required variables with empty values.

## Database migrations

Development uses `scripts/db-init.sql` — drops and recreates all tables on every run. Dev data is always throwaway.

Production uses numbered migration files (goose or golang-migrate) before first deploy. The migration tool runs as part of the deploy process before the binary starts.

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
