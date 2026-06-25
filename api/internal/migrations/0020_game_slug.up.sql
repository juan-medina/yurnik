ALTER TABLE igdb_game_details ADD COLUMN slug TEXT;

-- Force existing cached rows stale so the next detail fetch repopulates slug.
UPDATE igdb_game_details SET cached_at = NOW() - INTERVAL '10 day';
