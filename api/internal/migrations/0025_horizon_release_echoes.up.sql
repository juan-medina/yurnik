-- 1. Add the new column for IGDB games.
ALTER TABLE echoes ADD COLUMN subject_igdb_id integer REFERENCES igdb_games(igdb_id) ON DELETE SET NULL;

-- 2. Drop the existing inline CHECK constraint on the type column
ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;

-- 3. Recreate the CHECK constraint to allow the new horizon_release type
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_like', 'horizon_release'));

-- 4. Add the unique index to prevent duplicate release notifications per game per user
-- This also perfectly covers the NOT EXISTS subquery check for fast lookups.
CREATE UNIQUE INDEX echoes_release_unique_idx ON echoes(recipient_id, subject_igdb_id) WHERE type = 'horizon_release';

-- 5. Add an index to igdb_games to optimize the daemon's daily scan for upcoming releases
CREATE INDEX igdb_games_release_date_idx ON igdb_games(release_date);

-- 6. Add an index to horizon_entries on igdb_id to prevent sequential scans when joining from igdb_games
CREATE INDEX horizon_entries_igdb_id_idx ON horizon_entries(igdb_id);
