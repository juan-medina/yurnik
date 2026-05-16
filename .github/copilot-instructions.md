# Copilot Instructions

This is Agōn — an open social network for gaming sessions built on AT Proto. Three components in one monorepo:

- `api/` — Go API server
- `agent/` — C# tray agent (Windows, Velopack)
- `web/` — React + Vite frontend (Cloudflare Pages)

See `docs/DESIGN.md` for architecture decisions. See `docs/DEPLOYMENT.md` for hosting and infrastructure. See `CLAUDE.md` for coding conventions.

## Key rules

- YAGNI. Do not add abstractions, interfaces, or configuration that nothing uses yet
- Go errors are returned, not thrown. Log at the handling site, not the origin
- C# uses result types for expected failures, not exceptions for control flow
- AT Proto session records are only written on explicit user confirmation
- AT Proto records are fully denormalised — bake all game metadata in at publish time
- IGDB is only called from the Go API server. Never from the frontend or the agent
- The agent has no UI — configuration and session management open the web app via browser
- The agent communicates with the web app only through `agon://` URL scheme calls
- Bluesky OAuth is the only authentication method. Do not add alternatives
- Every `.go` file starts with `// SPDX-FileCopyrightText: 2026 Juan Medina` and `// SPDX-License-Identifier: MIT`
- Every `.cs` file starts with the same SPDX header
- Every `.ts` / `.tsx` file starts with the same SPDX header
- TypeScript strict mode. No `any`
- Functional components only
- Tests sit next to the code they cover. Go: `go test ./...`. C#: xUnit in `agent.Tests/`. React: Vitest via `pnpm test`

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
