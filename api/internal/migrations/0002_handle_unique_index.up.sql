-- Profile URLs move from UUID to Discord handle (e.g. /player/super_user1).
-- Handles are case-insensitive on Discord, so uniqueness is enforced on the
-- lowercased value. The login upsert is responsible for resolving collisions
-- before this index would ever reject a write.
CREATE UNIQUE INDEX users_handle_lower_idx ON users (lower(handle));
