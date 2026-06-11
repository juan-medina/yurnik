-- Supports querying "events performed by users I follow" for the realm
-- activity feed: filter echo_actors by actor_id and order by created_at.
CREATE INDEX echo_actors_actor_id_created_at_idx ON echo_actors(actor_id, created_at DESC);
