DROP INDEX IF EXISTS echoes_mention_unique_idx;
DELETE FROM echoes WHERE type = 'new_mention';
ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_comment_reply'));
DROP TABLE comment_mentions;
