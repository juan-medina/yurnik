#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Juan Medina
# SPDX-License-Identifier: MIT

set -euo pipefail

ok()  { echo "  [ok] $1"; }
err() { echo "  [x]  $1" >&2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_MAINT_BINARY=/tmp/yurnik-maintenance-new

rm -f "$TEMP_MAINT_BINARY"

ok "Building maintenance..."
cd "$REPO_ROOT/api"
YURNIK_ENV=production go build -o "$TEMP_MAINT_BINARY" ./cmd/maintenance
ok "Build succeeded"

# Replace binary. Systemd timer will pick up the new one on the next run.
rm -f /usr/local/bin/yurnik-maintenance
mv "$TEMP_MAINT_BINARY" /usr/local/bin/yurnik-maintenance
chmod +x /usr/local/bin/yurnik-maintenance

ok "Maintenance binary updated"
