-- Add path_hash to pending_journeys
ALTER TABLE pending_journeys ADD COLUMN path_hash text;

-- Truncate existing hints and exclusions for clean slate
TRUNCATE TABLE exe_game_hints;
TRUNCATE TABLE exe_exclusions;

-- Alter exe_game_hints to include path_hash in primary key
ALTER TABLE exe_game_hints DROP CONSTRAINT exe_game_hints_pkey;
ALTER TABLE exe_game_hints ADD COLUMN path_hash text NOT NULL DEFAULT '';
ALTER TABLE exe_game_hints ADD PRIMARY KEY (user_id, exe_name, path_hash);

-- Alter exe_exclusions to include path_hash in unique constraint
ALTER TABLE exe_exclusions DROP CONSTRAINT exe_exclusions_user_id_exe_name_key;
ALTER TABLE exe_exclusions ADD COLUMN path_hash text NOT NULL DEFAULT '';
ALTER TABLE exe_exclusions ADD CONSTRAINT exe_exclusions_user_id_exe_name_path_hash_key UNIQUE (user_id, exe_name, path_hash);
