-- Successful, identity-bound checks only. Historic blanks remain unchecked.
CREATE TABLE movie_maintenance_coverage (
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('omdb','tmdb','mdblist')),
  domain TEXT NOT NULL CHECK(domain IN ('metadata','scores')),
  identity_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  absent_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(absent_json)),
  PRIMARY KEY(movie_id,provider,domain)
);

CREATE TABLE movie_maintenance_failures (
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('omdb','tmdb','mdblist')),
  operation TEXT NOT NULL CHECK(operation IN ('scores','omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment')),
  attempted_at TEXT NOT NULL,
  PRIMARY KEY(movie_id,provider,operation)
);
