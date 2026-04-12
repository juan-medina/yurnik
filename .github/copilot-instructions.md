# Copilot Instructions

This is Agōn — an open social network for gaming sessions built on AT Proto. Three components in one monorepo: a Go API server (`cmd/api`, `internal/`), a Go tray agent (`cmd/agent`), and a React frontend (`web/`).

See `docs/DESIGN.md` for architecture decisions. See `CLAUDE.md` for coding conventions.

## Key rules

- YAGNI. Do not add abstractions, interfaces, or configuration that nothing uses yet
- Go errors are returned, not thrown. Log at the handling site, not the origin
- AT Proto session records are only written on explicit user confirmation
- IGDB is only called from the Go backend, never from the frontend
- Every `.go` file starts with the SPDX header: `// SPDX-FileCopyrightText: 2026 Juan Medina` and `// SPDX-License-Identifier: MIT`
- Every `.ts` / `.tsx` file starts with the same SPDX header
- TypeScript strict mode. No `any`
- Tests are written alongside the code they cover
