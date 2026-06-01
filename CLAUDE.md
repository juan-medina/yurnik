# CLAUDE.md

Guidance for Claude Code when working in this repository. For architecture and decisions see [`docs/DESIGN.md`](docs/DESIGN.md). For hosting and infrastructure see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Project

Yurnik is an open social network for gaming journeys. Three components in one monorepo:

- `api/` — Go API server
- `agent/` — C# tray agent (Windows, Velopack)
- `web/` — React + Vite frontend (deployed to Cloudflare Pages)

## Build commands

```sh
make api        # run Go API server
make web        # run React dev server
make test       # run all tests
make build      # production build of all components
```

The agent is built with .NET tooling — see `agent/README.md`.

## Principles

- **YAGNI** — only what is needed for the current scope
- No speculative abstractions. Interfaces when there is more than one implementation, not before
- No exceptions for control flow. Return errors explicitly in Go, use Result types in C#
- Tests from the start — behaviour that would be painful to debug manually gets a test
- Comments only for non-obvious logic

## Rate limiting

Rate limiting is not a hardening afterthought — it is a first-class constraint that every API route is built within. It protects against external abuse and our own bugs equally.

The Go API server uses a global token bucket limiter (`golang.org/x/time/rate`) applied as middleware before any handler runs. The limit is read from `RATE_LIMIT_RPS` at startup. When the limit is exceeded the server returns `429 Too Many Requests` immediately — it does not queue, retry, or slow down.

The IGDB proxy enforces a separate hard sub-limit of 4 requests/second upstream, regardless of how many inbound requests are in flight. This is enforced in code, not relied upon from IGDB's own 429 responses.

When writing code that calls external services or downstream dependencies, never assume rate limiting is someone else's problem. Any retry logic must use exponential backoff with a cap. Unbounded retry loops are bugs.

## Go — api/

- `gofmt` always. CI rejects unformatted code
- Errors are returned up the call stack and logged at the boundary where they are handled. Never swallowed silently
- No global state. Dependencies are injected
- File header on every `.go` file:

```go
// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
```

## C# — agent/

- .NET 9, nullable reference types enabled, warnings as errors
- No exceptions for control flow. Prefer returning null or a result type for expected failures
- No UI beyond the system tray icon — any configuration or journey management opens the web app via the default browser
- The agent registers `yurnik://` as a custom URL scheme. URL handlers are the only way the web app communicates back to the agent
- The agent must never hammer the API. Heartbeats are every 10 minutes. Any retry on failure must use exponential backoff. There is no scenario in which the agent sends requests in a tight loop
- File header on every `.cs` file:

```csharp
// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
```

## TypeScript / React — web/

- Strict TypeScript. No `any`
- Functional components only
- File header on every `.ts` / `.tsx` file:

```ts
// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
```

## IGDB

All IGDB calls go through the Go API server. The Twitch client secret never reaches the frontend or the agent. Responses are cached in Postgres with a TTL. The IGDB proxy enforces a hard upstream rate limit of 4 req/s — a cache hit must never result in an IGDB call.

## Authentication

Discord OAuth only. Users log in with their Discord account — highest account penetration among the target audience. Do not add alternative auth providers.

## Testing

- Go: `go test ./...` — unit tests sit next to the code they test
- C#: xUnit — tests in `agent.Tests/`
- React: Vitest via `pnpm test`

## Testing Philosophy

**Only test things that can change.**

If a value is always the same regardless of any condition, testing it is pure duplication.
The test will only ever fail when you intentionally change that value — meaning it
punishes refactoring without catching real bugs.

### The variability rule

Before writing any assertion, ask: **"can this value ever be different?"**

- If **no** — it's a static value. Don't test it. The code itself is the source of truth.
- If **yes** — ask what conditions make it different. Test those conditions and transitions.

### What "can change" means

A value can change when it depends on:
- A condition (user logged in / out, feature flag, permissions)
- State (toggled, selected, submitted, loading, error)
- Input (props, route, user interaction)
- Time or sequence (before/after an action)

If none of those apply, the value is static. Leave it alone.

### Applied examples

A sidebar with fixed links → no test needed. The links are what they are.  
A sidebar that highlights the active page → test that. The highlight depends on the route.  
A label that always says "Settings" → no test needed.  
A label that says "Settings" or "Preferences" based on a user flag → test the two states.  
A menu that always shows 5 items → no test needed.  
A menu that hides admin items for non-admins → test both roles.  

### The failure check

Before committing a test, ask:
> "If this test fails, has something broken that a user would actually experience?"  
> "If this test passes, could the feature still be silently broken?"

If either answer is uncomfortable, rewrite or delete the test.
