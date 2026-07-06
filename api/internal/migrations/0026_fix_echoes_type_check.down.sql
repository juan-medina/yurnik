ALTER TABLE echoes DROP CONSTRAINT echoes_type_check;
ALTER TABLE echoes ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_like', 'horizon_release'));
