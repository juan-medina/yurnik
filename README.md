# Yurnik

Yurnik is a social network for gaming journeys. Log what you play, see what people you follow are playing, discover games through the people you trust.

## What it is

- **Automatic journey detection** — a lightweight tray agent watches for running games using graphics API detection, no manual logging required
- **Social feed** — see what people you follow have been playing in real time
- **Game discovery** — recommendations based on your play history and your network's

## What it is not

- A game launcher
- A library manager
- A backlog tracker

## Status

Early development. Not ready for use.

## Development

Requirements: Go 1.23+, Node 22 (via fnm), pnpm, Net 9

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
