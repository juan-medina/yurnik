-- Revert JSONB preferences migration
ALTER TABLE users ALTER COLUMN notification_preferences SET DEFAULT '{"updates":true,"echoes":true}';

UPDATE users 
SET notification_preferences = (
    notification_preferences - 'notifications' 
    || jsonb_build_object('echoes', notification_preferences->'notifications')
)
WHERE notification_preferences ? 'notifications';

-- Activity events constraint update
ALTER TABLE activity_events DROP CONSTRAINT activity_events_type_check;

UPDATE activity_events SET type = 'horizon_add' WHERE type = 'backlog_add';
ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_check
    CHECK (type IN ('new_comment', 'new_follower', 'horizon_add'));

-- Update notification type
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;

UPDATE notifications SET type = 'horizon_release' WHERE type = 'backlog_release';
ALTER TABLE notifications ADD CONSTRAINT echoes_type_check CHECK (type IN ('new_comment', 'new_follower', 'new_comment_reply', 'new_mention', 'horizon_release'));

-- Rename indexes back
ALTER INDEX backlog_entries_igdb_id_idx RENAME TO horizon_entries_igdb_id_idx;
ALTER INDEX backlog_entries_player_id_igdb_id_key RENAME TO horizon_entries_player_id_igdb_id_key;
ALTER INDEX backlog_entries_player_id_added_at_idx RENAME TO horizon_entries_player_id_added_at_idx;
ALTER INDEX backlog_entries_player_id_position_idx RENAME TO horizon_entries_player_id_position_idx;
ALTER INDEX backlog_entries_pkey RENAME TO horizon_entries_pkey;

ALTER INDEX notification_actors_pkey RENAME TO echo_actors_pkey;
ALTER INDEX notification_actors_actor_id_created_at_idx RENAME TO echo_actors_actor_id_created_at_idx;

ALTER INDEX notifications_active_batch_idx RENAME TO echoes_active_batch_idx;
ALTER INDEX notifications_recipient_updated_idx RENAME TO echoes_recipient_updated_idx;
ALTER INDEX notifications_updated_at_idx RENAME TO echoes_updated_at_idx;
ALTER INDEX notifications_pkey RENAME TO echoes_pkey;

-- Rename sequences back
ALTER SEQUENCE backlog_entries_id_seq RENAME TO horizon_entries_id_seq;
ALTER SEQUENCE notifications_id_seq RENAME TO echoes_id_seq;

-- Rename column back
ALTER TABLE notification_actors RENAME COLUMN notification_id TO echo_id;

-- Rename constraints back (while tables are still named the new names)
ALTER TABLE notifications RENAME CONSTRAINT notifications_recipient_id_fkey TO echoes_recipient_id_fkey;
ALTER TABLE notifications RENAME CONSTRAINT notifications_subject_id_fkey TO echoes_subject_id_fkey;
ALTER TABLE notifications RENAME CONSTRAINT notifications_subject_igdb_id_fkey TO echoes_subject_igdb_id_fkey;

ALTER TABLE notification_actors RENAME CONSTRAINT notification_actors_notification_id_fkey TO echo_actors_echo_id_fkey;
ALTER TABLE notification_actors RENAME CONSTRAINT notification_actors_actor_id_fkey TO echo_actors_actor_id_fkey;

ALTER TABLE backlog_entries RENAME CONSTRAINT backlog_entries_player_id_fkey TO horizon_entries_player_id_fkey;
ALTER TABLE backlog_entries RENAME CONSTRAINT backlog_entries_igdb_id_fkey TO horizon_entries_igdb_id_fkey;

-- Rename tables back
ALTER TABLE backlog_entries RENAME TO horizon_entries;
ALTER TABLE notification_actors RENAME TO echo_actors;
ALTER TABLE notifications RENAME TO echoes;
