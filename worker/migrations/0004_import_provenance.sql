-- Preserve distinct observations from the same archive without invented times.
ALTER TABLE source_scores RENAME TO source_scores_before_refs;
CREATE TABLE source_scores (
 id TEXT PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, metric TEXT NOT NULL, raw_value REAL NOT NULL,
 raw_scale REAL CHECK(raw_scale > 0), normalized_value REAL CHECK(normalized_value BETWEEN 0 AND 100),
 vote_count INTEGER CHECK(vote_count >= 0), fetched_at TEXT NOT NULL,
 import_source TEXT, import_key TEXT, retrieved_via TEXT NOT NULL DEFAULT 'unspecified', upstream_updated_at TEXT,
 source_ref TEXT NOT NULL DEFAULT '', source_ordinal INTEGER CHECK(source_ordinal > 0),
 legacy_preferred INTEGER NOT NULL DEFAULT 0 CHECK(legacy_preferred IN (0,1)),
 UNIQUE(movie_id,provider,metric,retrieved_via,fetched_at,source_ref), UNIQUE(import_source,import_key)
);
INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,import_source,import_key,retrieved_via,upstream_updated_at)
 SELECT id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,import_source,import_key,retrieved_via,upstream_updated_at FROM source_scores_before_refs;
DROP TABLE source_scores_before_refs;
CREATE INDEX scores_by_movie ON source_scores(movie_id,provider,metric,retrieved_via,fetched_at);
CREATE TABLE movie_import_refs (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 import_source TEXT NOT NULL, source_ref TEXT NOT NULL, source_ordinal INTEGER CHECK(source_ordinal > 0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(import_source,source_ref)
);
INSERT INTO movie_import_refs(movie_id,import_source,source_ref)
 SELECT id,import_source,import_key FROM movies WHERE import_source IS NOT NULL AND import_key IS NOT NULL;
-- Import refs for Should Watch audit membership as well as movie identity.
CREATE TABLE import_applied_entities (
 import_source TEXT NOT NULL, entity_type TEXT NOT NULL, import_key TEXT NOT NULL,
 payload_hash TEXT NOT NULL, PRIMARY KEY(import_source,entity_type,import_key)
);
CREATE TABLE seen_import_observations (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 import_source TEXT NOT NULL, source_ref TEXT NOT NULL,
 member_id TEXT NOT NULL REFERENCES members(id), seen INTEGER NOT NULL CHECK(seen IN (0,1)), observed_at TEXT NOT NULL,
 PRIMARY KEY(import_source,source_ref,member_id),
 FOREIGN KEY(import_source,source_ref) REFERENCES movie_import_refs(import_source,source_ref)
);
