-- Dev database initialisation. Drops and recreates all tables on every run.
-- Dev data is always throwaway -- re-run freely after schema changes.
-- Switch to numbered migration files (goose/golang-migrate) before shipping.
-- Passwords are set by db-init.ps1 after this file runs.
-- Do not run this file directly; use: scripts/db-init.ps1

-- Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agon_admin') THEN
        CREATE ROLE agon_admin WITH LOGIN PASSWORD 'placeholder';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agon_api') THEN
        CREATE ROLE agon_api WITH LOGIN PASSWORD 'placeholder';
    END IF;
END
$$;

-- Database
SELECT 'CREATE DATABASE agon_dev OWNER agon_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agon_dev')\gexec

-- Connect to the dev database for the rest
\connect agon_dev

-- Schema ownership
ALTER SCHEMA public OWNER TO agon_admin;

-- agon_api gets DML only -- no DDL
GRANT CONNECT ON DATABASE agon_dev TO agon_api;
GRANT USAGE ON SCHEMA public TO agon_api;

-- Apply to any tables created in the future by agon_admin
ALTER DEFAULT PRIVILEGES FOR ROLE agon_admin IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agon_api;

ALTER DEFAULT PRIVILEGES FOR ROLE agon_admin IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO agon_api;

-- Tables
-- Drop in reverse FK order so the script is re-runnable after schema changes.
-- Created as agon_admin so the default privileges above apply automatically.
SET ROLE agon_admin;

DROP TABLE IF EXISTS user_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS igdb_games;

-- Agōn-specific user data only. Bluesky profile fields (handle, display_name,
-- avatar) are never stored here — they are fetched live from the Bluesky AppView
-- on every request so they are always current.
CREATE TABLE users (
    did          text        PRIMARY KEY,
    bio          text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Bluesky OAuth tokens. Refreshed ~hourly; kept separate to avoid churn on users.
-- dpop_key_id maps to the server DPoP keypair used during the auth flow.
-- Currently always 'default' (keys/dpop.pem); the column is ready for key rotation.
CREATE TABLE user_tokens (
    did                     text        PRIMARY KEY REFERENCES users(did) ON DELETE CASCADE,
    access_token            text        NOT NULL,
    refresh_token           text        NOT NULL,
    access_token_expires_at timestamptz NOT NULL,
    dpop_key_id             text        NOT NULL DEFAULT 'default',
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- IGDB response cache. Keyed by IGDB game ID. Refreshed when cached_at is older
-- than the TTL checked at query time — a cache hit never triggers an IGDB call.
CREATE TABLE igdb_games (
    igdb_id   integer     PRIMARY KEY,
    name      text        NOT NULL,
    cover_url text,
    genres    text[]      NOT NULL DEFAULT '{}',
    cached_at timestamptz NOT NULL DEFAULT now()
);

RESET ROLE;
