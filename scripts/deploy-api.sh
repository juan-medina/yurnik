#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Juan Medina
# SPDX-License-Identifier: MIT
#
# Safe deploy: builds to a temp path first.
# The running service is only stopped if the build succeeds, and migrations
# run while the service is stopped so no binary ever runs against a schema
# it wasn't built for. If migrations fail, the old binary is restarted
# against the (unchanged) old schema -- migrate only commits a version once
# its migration's transaction succeeds.

set -euo pipefail

ok()  { echo "  [ok] $1"; }
err() { echo "  [x]  $1" >&2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_API_BINARY=/tmp/yurnik-api-new

rm -f "$TEMP_API_BINARY"

ok "Building..."
cd "$REPO_ROOT/api"
YURNIK_ENV=production go build -o "$TEMP_API_BINARY" ./cmd/api
ok "Build succeeded"

systemctl stop yurnik

if ! YURNIK_ENV=production bash "$REPO_ROOT/scripts/db-migrate.sh"; then
    err "Migration failed -- restarting previous version"
    systemctl start yurnik
    exit 1
fi
ok "Migrations applied"

rm -f /usr/local/bin/yurnik-api
mv "$TEMP_API_BINARY" /usr/local/bin/yurnik-api
chmod +x /usr/local/bin/yurnik-api

systemctl start yurnik
ok "Service restarted"
