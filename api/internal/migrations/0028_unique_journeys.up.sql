-- Deduplicate journeys
DELETE FROM journeys
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id, igdb_id, started_at ORDER BY created_at ASC) as row_num
        FROM journeys
    ) t
    WHERE t.row_num > 1
);

-- Deduplicate pending_journeys
DELETE FROM pending_journeys
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id, exe_name, started_at ORDER BY created_at ASC) as row_num
        FROM pending_journeys
    ) t
    WHERE t.row_num > 1
);

-- Recreate pending_journeys unique index
ALTER TABLE pending_journeys DROP CONSTRAINT IF EXISTS pending_journeys_dedup_idx;
DROP INDEX IF EXISTS pending_journeys_dedup_idx;
CREATE UNIQUE INDEX pending_journeys_dedup_idx ON pending_journeys(user_id, exe_name, started_at);

-- Create journeys unique index
CREATE UNIQUE INDEX journeys_dedup_idx ON journeys(user_id, igdb_id, started_at);
