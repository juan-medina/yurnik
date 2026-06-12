DROP INDEX journeys_user_id_played_at_idx;
DROP INDEX journeys_igdb_id_played_at_idx;

ALTER TABLE journeys ALTER COLUMN played_at TYPE timestamptz USING played_at::timestamptz;

CREATE INDEX journeys_user_id_played_at_idx ON journeys(user_id, played_at DESC);
CREATE INDEX journeys_igdb_id_played_at_idx ON journeys(igdb_id, played_at DESC);
