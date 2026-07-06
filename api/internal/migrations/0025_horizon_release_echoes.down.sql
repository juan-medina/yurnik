DROP INDEX horizon_entries_igdb_id_idx;
DROP INDEX igdb_games_release_date_idx;
DROP INDEX echoes_release_unique_idx;
ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_like'));
ALTER TABLE echoes DROP COLUMN subject_igdb_id;
