ALTER TABLE users ADD CONSTRAINT users_bio_length CHECK (char_length(bio) <= 400);
