DROP INDEX IF EXISTS echoes_comment_reply_unique_idx;
DELETE FROM echoes WHERE type = 'new_comment_reply';
ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower'));
