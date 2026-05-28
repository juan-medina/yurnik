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

DROP TABLE IF EXISTS echoes;
DROP TABLE IF EXISTS comments_index;
DROP TABLE IF EXISTS likes_index;
DROP TABLE IF EXISTS players_index;
DROP TABLE IF EXISTS journeys_index;
DROP TABLE IF EXISTS pending_journeys;
DROP TABLE IF EXISTS exe_game_hints;
DROP TABLE IF EXISTS exe_exclusions;
DROP TABLE IF EXISTS user_tokens;
DROP TABLE IF EXISTS igdb_games;
DROP TABLE IF EXISTS users;

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

-- Executables the agent must never create a pending journey for, per user.
-- Added inline from the pending journey card or from the Settings page.
CREATE TABLE exe_exclusions (
    did        text NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    exe_name   text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (did, exe_name)
);

-- Learned exe → IGDB ID mappings, per user. Written when the user corrects a
-- game match during confirmation. On repeat detections from the same exe the
-- server checks here before attempting IGDB fuzzy matching.
CREATE TABLE exe_game_hints (
    did        text    NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    exe_name   text    NOT NULL,
    igdb_id    integer NOT NULL REFERENCES igdb_games(igdb_id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (did, exe_name)
);

-- Unconfirmed journeys from agent detection only. Manual journeys skip this table
-- entirely and are published straight to AT Proto. Evicted after 7 days by pg_cron.
-- On confirmation, the journey is published to AT Proto first; this row is deleted
-- only on success so a failed publish is retryable. Discarded journeys are deleted
-- with no further action.
CREATE TABLE pending_journeys (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    did            text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    igdb_id        integer     REFERENCES igdb_games(igdb_id),
    exe_name       text,
    window_title   text,
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz,
    last_heartbeat timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pending_journeys_did_idx     ON pending_journeys(did);
CREATE INDEX pending_journeys_status_idx  ON pending_journeys(status);
CREATE INDEX pending_journeys_heartbeat_idx ON pending_journeys(last_heartbeat);

-- AT Proto index tables. These are local mirrors of records that live on the
-- Bluesky PDS. They exist to serve queries cheaply without calling the PDS.
-- All four tables are rebuildable from AT Proto if lost.

-- Mirror of app.agon.journey records. Written on confirm, deleted on journey
-- delete. Powers the Realm feed (joined against players_index) and the
-- "on this journey" sections in journey detail.
CREATE TABLE journeys_index (
    journey_uri text        PRIMARY KEY,
    igdb_id     integer     NOT NULL REFERENCES igdb_games(igdb_id),
    user_did    text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    played_at   timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journeys_index_igdb_id_played_at_idx ON journeys_index(igdb_id, played_at DESC);
CREATE INDEX journeys_index_user_did_played_at_idx ON journeys_index(user_did, played_at DESC);

-- Mirror of app.agon.player records. Written on follow, deleted on unfollow.
-- Powers the Realm feed join and follower/following lists.
CREATE TABLE players_index (
    follower_did text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    followee_did text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_did, followee_did)
);

CREATE INDEX players_index_followee_did_idx ON players_index(followee_did);

-- Mirror of app.agon.like records. Written on like, deleted on unlike.
-- Powers like counts and the liked-by list on journey detail.
CREATE TABLE likes_index (
    journey_uri text        NOT NULL,
    liker_did   text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    like_uri    text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (journey_uri, liker_did)
);

CREATE INDEX likes_index_journey_uri_idx ON likes_index(journey_uri);

-- Mirror of app.agon.comment records. Written on post, deleted on delete.
-- Powers the comment list on journey detail, chronological order.
CREATE TABLE comments_index (
    comment_uri   text        PRIMARY KEY,
    journey_uri   text        NOT NULL,
    commenter_did text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    body          text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_index_journey_uri_idx ON comments_index(journey_uri, created_at ASC);

-- In-app notifications, per user. Written when another player comments on your
-- journey, or when someone follows you. Marked read when the user visits /echoes.
-- kind: 'comment' | 'follower'
CREATE TABLE echoes (
    id           bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    did          text        NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    kind         text        NOT NULL CHECK (kind IN ('comment', 'follower')),
    actor_did    text        NOT NULL,
    journey_uri  text,
    comment_uri  text,
    read         boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX echoes_did_read_idx ON echoes(did, read, created_at DESC);

RESET ROLE;
