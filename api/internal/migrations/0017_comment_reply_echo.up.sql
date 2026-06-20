-- Notifies prior commenters on a journey when someone else comments after
-- them, not just the journey owner.
ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_comment_reply'));
CREATE UNIQUE INDEX echoes_comment_reply_unique_idx ON echoes(recipient_id, subject_id) WHERE type = 'new_comment_reply';
