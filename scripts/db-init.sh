#!/usr/bin/env bash
# scripts/db-init.sh
# Initialises the database and writes DATABASE_URL / DATABASE_ADMIN_URL to the env file.
#
# Dev (default): writes to .env in the repo root, seeding from .env.example on first run.
# Production:    set YURNIK_ENV=production — writes to /etc/yurnik/env (chmod 600).
#
# Safe to run multiple times — only the two DB vars are ever overwritten.

set -euo pipefail

ok()   { echo "  [ok] $1"; }
info() { echo "  [-]  $1"; }
err()  { echo "  [x]  $1" >&2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$(dirname "${BASH_SOURCE[0]}")/db-init.sql"

if [ "${YURNIK_ENV:-}" = "production" ]; then
    ENV_FILE="/etc/yurnik/env"
else
    ENV_FILE="$REPO_ROOT/.env"
fi

# ci: a Postgres service container, reached over TCP as the postgres
# superuser via PGHOST/PGUSER/PGPASSWORD -- no systemd, no local peer auth.
if [ "${YURNIK_ENV:-}" = "ci" ]; then
    PSQL=(psql)
else
    # Check postgres is running (skip with --no-check for local CI-like use)
    if [[ " $* " != *" --no-check "* ]]; then
        if ! systemctl is-active --quiet postgresql; then
            err "Postgres is not running. Start it with: make db-start"
            exit 1
        fi
        ok "Postgres is running"
    fi
    PSQL=(sudo -u postgres psql)
fi

# Generate passwords
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '+/=\n' | cut -c1-32)
API_PASSWORD=$(openssl rand -base64 24 | tr -d '+/=\n' | cut -c1-32)

# Run SQL
info "Initialising database..."
"${PSQL[@]}" -f "$SQL_FILE"
"${PSQL[@]}" -c "ALTER ROLE yurnik_admin WITH PASSWORD '$ADMIN_PASSWORD';"
"${PSQL[@]}" -c "ALTER ROLE yurnik_api WITH PASSWORD '$API_PASSWORD';"
ok "Database initialised"

# Prepare the env file
if [ "${YURNIK_ENV:-}" = "production" ]; then
    mkdir -p /etc/yurnik
    touch "$ENV_FILE"
    chmod 600 "$ENV_FILE"
else
    if [ ! -f "$ENV_FILE" ]; then
        cp "$REPO_ROOT/.env.example" "$ENV_FILE"
        info ".env created from .env.example"
    fi
fi

# Update a key=value line in the env file, appending if not present
set_env_line() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

set_env_line "DATABASE_URL"       "postgres://yurnik_api:${API_PASSWORD}@localhost:5432/yurnik"
set_env_line "DATABASE_ADMIN_URL" "postgres://yurnik_admin:${ADMIN_PASSWORD}@localhost:5432/yurnik"

ok "$(basename "$ENV_FILE") updated (DATABASE_URL, DATABASE_ADMIN_URL)"
echo ""
ok "Database ready."
