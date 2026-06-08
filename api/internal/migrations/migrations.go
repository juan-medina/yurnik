// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// Package migrations embeds the versioned schema migration SQL files so the
// migrate tool can be a single self-contained binary with no runtime
// dependency on the repository layout.
package migrations

import "embed"

//go:embed *.sql
var Files embed.FS
