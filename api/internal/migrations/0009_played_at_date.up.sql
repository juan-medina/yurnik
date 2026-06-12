-- played_at represents which day a journey was played, not when. Drop the
-- time-of-day component so the same day's journeys compare equal and sort
-- by created_at (insertion order) as a tiebreaker instead.
ALTER TABLE journeys ALTER COLUMN played_at TYPE date USING played_at::date;

DROP INDEX journeys_user_id_played_at_idx;
DROP INDEX journeys_igdb_id_played_at_idx;

CREATE INDEX journeys_user_id_played_at_idx ON journeys(user_id, played_at DESC, created_at DESC);
CREATE INDEX journeys_igdb_id_played_at_idx ON journeys(igdb_id, played_at DESC, created_at DESC);
