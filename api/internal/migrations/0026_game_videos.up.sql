ALTER TABLE igdb_game_details RENAME COLUMN trailer_id TO old_trailer_id;
ALTER TABLE igdb_game_details ADD COLUMN videos text[] NOT NULL DEFAULT '{}';

UPDATE igdb_game_details 
SET videos = ARRAY[old_trailer_id]
WHERE old_trailer_id IS NOT NULL;

UPDATE igdb_game_details 
SET cached_at = '1970-01-01 00:00:00' 
WHERE old_trailer_id IS NOT NULL;

ALTER TABLE igdb_game_details DROP COLUMN old_trailer_id;
