-- Explicit one-time maintenance only; never run automatically on startup.
INSERT INTO seen_states(movie_id,member_id,seen)
SELECT c.movie_id,m.id,1
FROM classics c CROSS JOIN members m
WHERE m.active=1
  AND EXISTS (SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id
              WHERE sm.movie_id=c.movie_id AND s.deleted_at IS NULL)
ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=1,
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE seen_states.seen<>1;
