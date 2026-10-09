-- Additive provider-owned field checks. No inferred negatives or provider backfill.
CREATE TABLE IF NOT EXISTS movie_maintenance_fields (
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('omdb','tmdb','mdblist')),
  operation TEXT NOT NULL,
  identity_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  checks_json TEXT NOT NULL CHECK(json_valid(checks_json) AND json_type(checks_json)='object'),
  PRIMARY KEY(movie_id,provider,operation)
);
