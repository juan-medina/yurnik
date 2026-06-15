#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Juan Medina
# SPDX-License-Identifier: MIT

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "${YURNIK_ENV:-}" = "production" ]; then
    ENV_FILE="/etc/yurnik/env"
else
    ENV_FILE="$REPO_ROOT/.env"
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

cd "$REPO_ROOT/api"
go run ./cmd/export-user "$@"
