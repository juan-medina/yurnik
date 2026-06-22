-- Mentions are resolved to a stable user_id at write time (never matched by
-- handle text), so a later Discord handle rename is reflected automatically
-- when the mention is rendered. start_offset/length record where in the
-- comment's body the "@handle" token was typed, so it can be located again
-- at render time regardless of how long the current handle is.
CREATE TABLE comment_mentions (
    comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_offset int NOT NULL,
    length int NOT NULL,
    PRIMARY KEY (comment_id, mentioned_user_id)
);

CREATE INDEX comment_mentions_mentioned_user_id_idx ON comment_mentions(mentioned_user_id);

ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_comment_reply', 'new_mention'));
CREATE UNIQUE INDEX echoes_mention_unique_idx ON echoes(recipient_id, subject_id) WHERE type = 'new_mention';
