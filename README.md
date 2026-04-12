# Agōn

> *ἀγών — a gathering, a contest, a session of play*

Agōn is an open social network for gaming sessions. Log what you play, see what friends are playing, discover games through the people you trust.

## What it is

- **Automatic session detection** — a lightweight tray agent watches for running games using graphics API detection, no manual logging required
- **Open and federated** — built on AT Proto, your data is yours and portable
- **Social feed** — see what people you follow have been playing in real time
- **Game discovery** — recommendations based on your play history and your network's

## What it is not

- A game launcher
- A library manager
- A backlog tracker

## Status

Early development. Not ready for use.

## Structure

```
cmd/api       API server entry point
cmd/agent     Tray agent entry point
internal/     Shared Go packages
web/          React frontend
docs/         Architecture and design decisions
```

## Development

Requirements: Go 1.23+, Node 22 (via fnm), pnpm

```sh
# API server
make api

# Tray agent
make agent

# Web frontend
make web

# All tests
make test
```

## License

MIT — see [LICENSE](LICENSE)

Copyright (c) 2026 Juan Medina
