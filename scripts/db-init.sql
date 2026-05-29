-- Dev database initialisation. Drops and recreates all tables on every run.
-- Dev data is always throwaway — re-run freely after schema changes.
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

SET ROLE agon_admin;

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

DROP TABLE IF EXISTS echoes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS journeys;
DROP TABLE IF EXISTS pending_journeys;
DROP TABLE IF EXISTS exe_game_hints;
DROP TABLE IF EXISTS exe_exclusions;
DROP TABLE IF EXISTS igdb_games;
DROP TABLE IF EXISTS users;

-- One row per player. provider + provider_id identify the user at login.
-- handle, name, and avatar_url are refreshed from the provider on every login.
-- The internal id (UUID) is what the rest of the system uses — provider
-- details are only joined at login time.
CREATE TABLE users (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider     text        NOT NULL,
    provider_id  text        NOT NULL,
    handle       text        NOT NULL,
    name         text        NOT NULL,
    avatar_url   text,
    bio          text,
    color        text        NOT NULL DEFAULT '#7c3aed',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
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

-- Executables the agent must never create a pending journey for, per user.
-- Added inline from the pending journey card or from the Settings page.
CREATE TABLE exe_exclusions (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exe_name   text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, exe_name)
);

-- Learned exe -> IGDB ID mappings, per user. Written when the user corrects a
-- game match during confirmation. On repeat detections from the same exe the
-- server checks here before attempting IGDB fuzzy matching.
CREATE TABLE exe_game_hints (
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exe_name   text        NOT NULL,
    igdb_id    integer     NOT NULL REFERENCES igdb_games(igdb_id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, exe_name)
);

-- Unconfirmed journeys from agent detection. Manual journeys skip this table
-- entirely. Evicted after 7 days by pg_cron. Discarded journeys are deleted
-- with no further action.
CREATE TABLE pending_journeys (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    igdb_id        integer     REFERENCES igdb_games(igdb_id),
    exe_name       text,
    window_title   text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz,
    last_heartbeat timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_journeys_user_id_idx    ON pending_journeys(user_id);
CREATE INDEX pending_journeys_status_idx     ON pending_journeys(status);
CREATE INDEX pending_journeys_heartbeat_idx  ON pending_journeys(last_heartbeat);

-- Confirmed journeys. Written on confirm (from pending) or on manual log.
-- This is the source of truth — there is no external record store.
CREATE TABLE journeys (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    igdb_id          integer     NOT NULL REFERENCES igdb_games(igdb_id),
    started_at       timestamptz NOT NULL,
    ended_at         timestamptz NOT NULL,
    duration_seconds integer     NOT NULL,
    log              text,
    played_at        timestamptz NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journeys_user_id_played_at_idx ON journeys(user_id, played_at DESC);
CREATE INDEX journeys_igdb_id_played_at_idx ON journeys(igdb_id, played_at DESC);

-- Follow graph. Written on follow, deleted on unfollow.
-- Powers the Realm feed join and follower/following lists.
CREATE TABLE follows (
    follower_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX follows_followee_id_idx ON follows(followee_id);

-- Likes. One row per (journey, user) pair.
-- Powers like counts and the liked-by list on journey detail.
CREATE TABLE likes (
    journey_id uuid        NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (journey_id, user_id)
);

-- Comments. Flat, chronological, attached to a journey.
-- Powers the comment list on journey detail.
CREATE TABLE comments (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id uuid        NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_journey_id_idx ON comments(journey_id, created_at ASC);

-- In-app notifications, per user. Written when another player comments on your
-- journey, or when someone follows you. Marked read when the user visits /echoes.
-- kind: 'comment' | 'follower'
CREATE TABLE echoes (
    id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        text        NOT NULL CHECK (kind IN ('comment', 'follower')),
    actor_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    journey_id  uuid        REFERENCES journeys(id) ON DELETE CASCADE,
    comment_id  uuid        REFERENCES comments(id) ON DELETE CASCADE,
    read        boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX echoes_user_id_read_idx ON echoes(user_id, read, created_at DESC);

RESET ROLE;
