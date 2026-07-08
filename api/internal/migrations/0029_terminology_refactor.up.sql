-- Rename constraints FIRST (before renaming the table, or specify the table's current name)
ALTER TABLE echoes RENAME CONSTRAINT echoes_recipient_id_fkey TO notifications_recipient_id_fkey;
ALTER TABLE echoes RENAME CONSTRAINT echoes_subject_id_fkey TO notifications_subject_id_fkey;
ALTER TABLE echoes RENAME CONSTRAINT echoes_subject_igdb_id_fkey TO notifications_subject_igdb_id_fkey;

ALTER TABLE echo_actors RENAME CONSTRAINT echo_actors_echo_id_fkey TO notification_actors_notification_id_fkey;
ALTER TABLE echo_actors RENAME CONSTRAINT echo_actors_actor_id_fkey TO notification_actors_actor_id_fkey;

ALTER TABLE horizon_entries RENAME CONSTRAINT horizon_entries_player_id_fkey TO backlog_entries_player_id_fkey;
ALTER TABLE horizon_entries RENAME CONSTRAINT horizon_entries_igdb_id_fkey TO backlog_entries_igdb_id_fkey;

-- Rename tables
ALTER TABLE echoes RENAME TO notifications;
ALTER TABLE echo_actors RENAME TO notification_actors;
ALTER TABLE horizon_entries RENAME TO backlog_entries;

-- Rename sequences (GENERATED ALWAYS AS IDENTITY creates a sequence)
ALTER SEQUENCE echoes_id_seq RENAME TO notifications_id_seq;
ALTER SEQUENCE horizon_entries_id_seq RENAME TO backlog_entries_id_seq;

-- Rename indexes for clarity
ALTER INDEX echoes_pkey RENAME TO notifications_pkey;
ALTER INDEX echoes_active_batch_idx RENAME TO notifications_active_batch_idx;
ALTER INDEX echoes_recipient_updated_idx RENAME TO notifications_recipient_updated_idx;
ALTER INDEX echoes_updated_at_idx RENAME TO notifications_updated_at_idx;

ALTER INDEX echo_actors_pkey RENAME TO notification_actors_pkey;
ALTER INDEX echo_actors_actor_id_created_at_idx RENAME TO notification_actors_actor_id_created_at_idx;

ALTER INDEX horizon_entries_pkey RENAME TO backlog_entries_pkey;
ALTER INDEX horizon_entries_player_id_added_at_idx RENAME TO backlog_entries_player_id_added_at_idx;
ALTER INDEX horizon_entries_player_id_igdb_id_key RENAME TO backlog_entries_player_id_igdb_id_key;
ALTER INDEX horizon_entries_igdb_id_idx RENAME TO backlog_entries_igdb_id_idx;
ALTER INDEX horizon_entries_player_id_position_idx RENAME TO backlog_entries_player_id_position_idx;

-- Rename constraint for type check
ALTER TABLE notifications DROP CONSTRAINT echoes_type_check;

-- Update notification type
UPDATE notifications SET type = 'backlog_release' WHERE type = 'horizon_release';
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_comment_reply', 'new_mention', 'backlog_release'));

-- Activity events constraint update
ALTER TABLE activity_events DROP CONSTRAINT activity_events_type_check;

UPDATE activity_events SET type = 'backlog_add' WHERE type = 'horizon_add';
ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_check
    CHECK (type IN ('new_comment', 'new_follower', 'backlog_add'));

-- Rename column in notification_actors
ALTER TABLE notification_actors RENAME COLUMN echo_id TO notification_id;

-- JSONB preferences migration (from 0030)
ALTER TABLE users ALTER COLUMN notification_preferences SET DEFAULT '{"updates":true,"notifications":true}';

UPDATE users 
SET notification_preferences = (
    notification_preferences - 'echoes' 
    || jsonb_build_object('notifications', notification_preferences->'echoes')
)
WHERE notification_preferences ? 'echoes';
