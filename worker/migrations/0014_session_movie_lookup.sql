-- Cover reverse film lookups used by Detail and maintenance scope.
CREATE INDEX session_movies_by_movie ON session_movies(movie_id,session_id,position);
