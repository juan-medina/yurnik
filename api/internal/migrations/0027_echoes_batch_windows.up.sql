-- Drop the infinite lifetime constraints
DROP INDEX IF EXISTS echoes_follower_unique_idx;
DROP INDEX IF EXISTS echoes_comment_unique_idx;
DROP INDEX IF EXISTS echoes_comment_reply_unique_idx;
DROP INDEX IF EXISTS echoes_mention_unique_idx;
DROP INDEX IF EXISTS echoes_release_unique_idx;

-- Add batching window column
ALTER TABLE echoes ADD COLUMN batch_until TIMESTAMPTZ;

-- Backfill existing echoes to seal them immediately
UPDATE echoes SET batch_until = updated_at;

-- Enforce constraint
ALTER TABLE echoes ALTER COLUMN batch_until SET NOT NULL;

-- Index to optimize finding the active batch for a specific subject/type
CREATE INDEX echoes_active_batch_idx ON echoes(recipient_id, type, batch_until) WHERE batch_until IS NOT NULL;
