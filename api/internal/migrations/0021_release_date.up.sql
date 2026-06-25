ALTER TABLE igdb_games ADD COLUMN release_date timestamptz;

-- Force existing details-cache rows stale so the next detail fetch backfills
-- release_date on igdb_games (igdb_games.cached_at itself is never read for
-- staleness, so it cannot be used to trigger a refetch).
UPDATE igdb_game_details SET cached_at = NOW() - INTERVAL '10 day';
