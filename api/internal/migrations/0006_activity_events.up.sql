-- Activity events power the Realm/Hero activity feeds (db.GetFollowingActivity,
-- db.GetUserActivity). They were previously read from echo_actors/echoes, which
-- conflated "things to show in feeds" with "things to notify a recipient about".
-- This table separates the two: echoes/echo_actors remain notification-only.
--
-- target_id is the player the action concerns (the journey owner for
-- new_comment, the followee for new_follower) — distinct from the actor.
CREATE TABLE activity_events (
    id            bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    actor_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          text        NOT NULL CHECK (type IN ('new_comment', 'new_follower')),
    subject_id    uuid        REFERENCES journeys(id) ON DELETE SET NULL,
    subject_title text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_actor_id_created_at_idx ON activity_events(actor_id, created_at DESC);

-- Backfill from existing echo_actors/echoes, skipping comment echoes whose
-- journey has since been deleted (subject_id is NULL) — these were already
-- excluded from the activity feed.
INSERT INTO activity_events (actor_id, target_id, type, subject_id, subject_title, created_at)
SELECT ea.actor_id, e.recipient_id, e.type, e.subject_id, e.subject_title, ea.created_at
FROM echo_actors ea
JOIN echoes e ON e.id = ea.echo_id
WHERE NOT (e.type = 'new_comment' AND e.subject_id IS NULL);
