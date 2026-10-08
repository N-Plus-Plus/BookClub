-- Latest successful identity-bound details evidence; absent rows remain unchecked.
CREATE TABLE movie_provider_collections (
  movie_id TEXT NOT NULL PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  identity_provider TEXT NOT NULL CHECK(identity_provider='tmdb'),
  external_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  collection_id INTEGER CHECK(collection_id>0),
  collection_name TEXT,
  CHECK((collection_id IS NULL AND collection_name IS NULL) OR
    (collection_id IS NOT NULL AND collection_name IS NOT NULL AND length(trim(collection_name))>0))
);
CREATE TABLE movie_provider_awards (
  movie_id TEXT NOT NULL PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  identity_provider TEXT NOT NULL CHECK(identity_provider='imdb'),
  external_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  awards_text TEXT,
  wins INTEGER CHECK(wins>=0),
  nominations INTEGER CHECK(nominations>=0),
  CHECK(awards_text IS NOT NULL OR (wins IS NULL AND nominations IS NULL)),
  CHECK(awards_text IS NULL OR length(trim(awards_text))>0)
);
-- Keep 0020 immutable, including its five-operation CHECK constraint.
CREATE TABLE movie_maintenance_evidence_failures (
  movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('tmdb','omdb')),
  operation TEXT NOT NULL CHECK(operation IN ('tmdb-collections','omdb-awards')),
  attempted_at TEXT NOT NULL,
  PRIMARY KEY(movie_id,provider,operation)
);
