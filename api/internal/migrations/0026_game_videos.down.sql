ALTER TABLE igdb_game_details ADD COLUMN trailer_id text;

UPDATE igdb_game_details 
SET trailer_id = videos[1] 
WHERE array_length(videos, 1) > 0;

ALTER TABLE igdb_game_details DROP COLUMN videos;
