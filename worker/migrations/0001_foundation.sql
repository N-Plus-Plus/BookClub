PRAGMA foreign_keys = ON;
CREATE TABLE members (
 id TEXT PRIMARY KEY, display_name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE movies (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, original_title TEXT, release_date TEXT,
 year INTEGER CHECK(year BETWEEN 1870 AND 2200), runtime INTEGER CHECK(runtime > 0), overview TEXT,
 import_source TEXT, import_key TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(import_source, import_key)
);
CREATE TABLE movie_external_ids (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, external_id TEXT NOT NULL,
 PRIMARY KEY(movie_id,provider), UNIQUE(provider,external_id)
);
CREATE TABLE movie_genres (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE, genre TEXT NOT NULL,
 PRIMARY KEY(movie_id,genre)
);
CREATE TABLE movie_assets (
 id TEXT PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('poster','backdrop')),
 reference TEXT NOT NULL, width INTEGER, height INTEGER, preferred INTEGER NOT NULL DEFAULT 0 CHECK(preferred IN (0,1)),
 fetched_at TEXT NOT NULL, UNIQUE(movie_id,provider,asset_type,reference)
);
CREATE UNIQUE INDEX one_preferred_asset ON movie_assets(movie_id,asset_type) WHERE preferred=1;
CREATE TABLE source_scores (
 id TEXT PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, metric TEXT NOT NULL, raw_value REAL NOT NULL,
 raw_scale REAL CHECK(raw_scale > 0), normalized_value REAL CHECK(normalized_value BETWEEN 0 AND 100),
 vote_count INTEGER CHECK(vote_count >= 0), fetched_at TEXT NOT NULL,
 import_source TEXT, import_key TEXT, UNIQUE(movie_id,provider,metric,fetched_at), UNIQUE(import_source,import_key)
);
CREATE INDEX scores_by_movie ON source_scores(movie_id,provider,metric,fetched_at);
CREATE TABLE sessions (
 id TEXT PRIMARY KEY, event_date TEXT NOT NULL, title TEXT,
 host_member_id TEXT REFERENCES members(id), legacy_cycle_label TEXT, notes TEXT,
 import_source TEXT, import_key TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(import_source,import_key)
);
CREATE INDEX sessions_by_date ON sessions(event_date DESC);
CREATE TABLE session_movies (
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 movie_id TEXT NOT NULL REFERENCES movies(id), position INTEGER NOT NULL CHECK(position > 0),
 PRIMARY KEY(session_id,position)
);
CREATE TABLE classics (
 movie_id TEXT PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
 added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 source TEXT, legacy_reference TEXT
);
CREATE TABLE seen_states (
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 member_id TEXT NOT NULL REFERENCES members(id), seen INTEGER NOT NULL CHECK(seen IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(movie_id,member_id)
);
-- Absence of seen_states row means UNKNOWN. Never coalesce it to false.
CREATE TABLE seed_runs (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
