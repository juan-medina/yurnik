-- Supports DISTINCT ON (igdb_id) / (user_id, igdb_id) queries that pick each
-- player's most recent journey per game (profile favorites, discovery feed),
-- avoiding a sort over a user's full journey history.
CREATE INDEX journeys_user_id_igdb_id_played_at_idx ON journeys(user_id, igdb_id, played_at DESC, created_at DESC);

-- Supports the merge-candidate lookup in UpsertPendingJourney, which filters
-- on all four columns on every agent heartbeat.
CREATE INDEX pending_journeys_merge_idx ON pending_journeys(user_id, exe_name, status, ended_at);
