ALTER TABLE exe_exclusions DROP CONSTRAINT exe_exclusions_user_id_exe_name_path_hash_key;
ALTER TABLE exe_exclusions DROP COLUMN path_hash;
ALTER TABLE exe_exclusions ADD CONSTRAINT exe_exclusions_user_id_exe_name_key UNIQUE (user_id, exe_name);

ALTER TABLE exe_game_hints DROP CONSTRAINT exe_game_hints_pkey;
ALTER TABLE exe_game_hints DROP COLUMN path_hash;
ALTER TABLE exe_game_hints ADD PRIMARY KEY (user_id, exe_name);

ALTER TABLE pending_journeys DROP COLUMN path_hash;
