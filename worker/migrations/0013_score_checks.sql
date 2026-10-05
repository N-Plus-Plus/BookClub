CREATE TABLE movie_score_checks (
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  score_key TEXT NOT NULL CHECK (score_key IN ('imdb:rating','rottentomatoes:audience','rottentomatoes:critic','letterboxd:rating','metacritic:critic','tmdb:rating')),
  available INTEGER NOT NULL CHECK (available IN (0,1)),
  checked_at TEXT NOT NULL,
  PRIMARY KEY (movie_id,score_key)
);
