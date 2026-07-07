-- Revert new column and index
DROP INDEX IF EXISTS echoes_active_batch_idx;

-- Clean up duplicates before restoring unique indexes
-- We keep only the most recent echo per user/subject/type
DELETE FROM echoes e1 USING echoes e2
WHERE e1.recipient_id = e2.recipient_id
  AND e1.type = e2.type
  AND (e1.subject_id = e2.subject_id OR (e1.subject_id IS NULL AND e2.subject_id IS NULL))
  AND (e1.subject_igdb_id = e2.subject_igdb_id OR (e1.subject_igdb_id IS NULL AND e2.subject_igdb_id IS NULL))
  AND e1.id < e2.id;

ALTER TABLE echoes DROP COLUMN IF EXISTS batch_until;

-- Restore infinite lifetime unique constraints
CREATE UNIQUE INDEX echoes_comment_unique_idx  ON echoes(recipient_id, subject_id) WHERE type = 'new_comment';
CREATE UNIQUE INDEX echoes_follower_unique_idx ON echoes(recipient_id)             WHERE type = 'new_follower';
CREATE UNIQUE INDEX echoes_comment_reply_unique_idx ON echoes(recipient_id, subject_id) WHERE type = 'new_comment_reply';
CREATE UNIQUE INDEX echoes_mention_unique_idx ON echoes(recipient_id, subject_id) WHERE type = 'new_mention';
CREATE UNIQUE INDEX echoes_release_unique_idx ON echoes(recipient_id, subject_igdb_id) WHERE type = 'horizon_release';
