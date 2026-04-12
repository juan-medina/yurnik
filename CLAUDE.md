# CLAUDE.md

Guidance for Claude Code when working in this repository. For architecture and decisions see [`docs/DESIGN.md`](docs/DESIGN.md).

## Project

Agōn is an open social network for gaming sessions built on AT Proto. Three components: a Go API server, a Go tray agent, and a React frontend.

## Build Commands

```sh
# Run individually
make api        # Go API server
make agent      # Go tray agent
make web        # React dev server

# Test everything
make test

# Production build
make build
```

## Principles

- **YAGNI** — only what is needed for the current scope
- No speculative abstractions. Interfaces when there is more than one implementation, not before
- No exceptions for control flow. Return errors explicitly
- Tests from the start — behaviour that would be painful to debug manually gets a test
- Comments only for non-obvious logic

## Go conventions

- `gofmt` always. CI rejects unformatted code
- Error handling: return errors up the call stack, log at the boundary where you handle them, never swallow silently
- No global state. Dependencies are injected
- File header on every `.go` file:

```go
// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
```

## TypeScript / React conventions

- Strict TypeScript. No `any`
- Functional components only
- File header on every `.ts` / `.tsx` file:

```ts
// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
```

## AT Proto

Session records are published to AT Proto only when the user explicitly confirms them. Never write to the user's AT Proto repo without an explicit user action. The Lexicon for session records lives in `docs/DESIGN.md`.

## IGDB

All IGDB calls go through the Go API server. The Twitch client secret never reaches the frontend. Responses are cached — do not add direct IGDB calls from the React app.

## Testing

- Go: `go test ./...` — unit tests sit next to the code they test
- React: `pnpm test` via Vitest
- Test behaviour, not implementation. If a test would survive a refactor unchanged, it is a good test
