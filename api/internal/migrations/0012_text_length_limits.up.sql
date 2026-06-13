-- Cap journey logs and comments at 400 characters, matching the limit
-- enforced by the API and the frontend. A database-level backstop in case
-- either of those is ever bypassed.
ALTER TABLE journeys ADD CONSTRAINT journeys_log_length CHECK (char_length(log) <= 400);
ALTER TABLE comments ADD CONSTRAINT comments_body_length CHECK (char_length(body) <= 400);
