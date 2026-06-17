CREATE TABLE reports (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type  text        NOT NULL CHECK (target_type IN ('journey_log', 'comment', 'profile')),
    target_id    uuid        NOT NULL,
    context_id   uuid,
    reason       text        NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'explicit', 'impersonation', 'private_info', 'other')),
    note         text        CHECK (char_length(note) <= 200),
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX reports_created_at_idx ON reports(created_at DESC);
