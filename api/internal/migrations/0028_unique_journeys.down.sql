DROP INDEX IF EXISTS journeys_dedup_idx;

DROP INDEX IF EXISTS pending_journeys_dedup_idx;
CREATE UNIQUE INDEX pending_journeys_dedup_idx ON pending_journeys(user_id, exe_name, started_at, ended_at) WHERE ended_at IS NOT NULL;
