CREATE TABLE cycles (
 id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL UNIQUE CHECK(ordinal > 0), rough_date TEXT NOT NULL, title TEXT,
 import_source TEXT, import_key TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(import_source,import_key)
);
ALTER TABLE sessions ADD COLUMN cycle_id TEXT REFERENCES cycles(id);
ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'hosted' CHECK(kind IN ('hosted','classics'));
ALTER TABLE sessions ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'exact' CHECK(date_precision IN ('exact','cycle_rough','unknown'));
ALTER TABLE sessions ADD COLUMN cycle_slot INTEGER CHECK(cycle_slot BETWEEN 1 AND 5);
CREATE INDEX sessions_by_cycle ON sessions(cycle_id,cycle_slot);
ALTER TABLE classics ADD COLUMN rank_seed INTEGER CHECK(rank_seed > 0);
UPDATE classics SET rank_seed=(SELECT COUNT(*) FROM classics c WHERE c.movie_id <= classics.movie_id);
CREATE UNIQUE INDEX classics_rank_seed ON classics(rank_seed);
CREATE TABLE classics_seed_allocations (movie_id TEXT PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE, rank_seed INTEGER NOT NULL UNIQUE CHECK(rank_seed > 0));
INSERT INTO classics_seed_allocations SELECT movie_id,rank_seed FROM classics;
CREATE TABLE rank_seed_counter (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
INSERT INTO rank_seed_counter VALUES(1,COALESCE((SELECT MAX(rank_seed) FROM classics),0));
CREATE TRIGGER classics_seed AFTER INSERT ON classics WHEN NEW.rank_seed IS NULL BEGIN
 UPDATE rank_seed_counter SET value=value+1 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM classics_seed_allocations WHERE movie_id=NEW.movie_id);
 INSERT OR IGNORE INTO classics_seed_allocations VALUES(NEW.movie_id,(SELECT value FROM rank_seed_counter WHERE id=1));
 UPDATE classics SET rank_seed=(SELECT rank_seed FROM classics_seed_allocations WHERE movie_id=NEW.movie_id) WHERE movie_id=NEW.movie_id;
END;
CREATE TRIGGER classics_explicit_seed AFTER INSERT ON classics WHEN NEW.rank_seed IS NOT NULL BEGIN
 INSERT INTO classics_seed_allocations VALUES(NEW.movie_id,NEW.rank_seed) ON CONFLICT(movie_id) DO UPDATE SET rank_seed=excluded.rank_seed;
 UPDATE rank_seed_counter SET value=MAX(value,NEW.rank_seed) WHERE id=1;
END;
ALTER TABLE source_scores ADD COLUMN retrieved_via TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE source_scores ADD COLUMN upstream_updated_at TEXT;
UPDATE source_scores SET retrieved_via=CASE WHEN import_source='demo' THEN 'development-demo' WHEN provider='tmdb' THEN 'tmdb' ELSE 'unspecified' END;
-- Keep all snapshots, allowing multiple retrieval services at the same capture time.
ALTER TABLE source_scores RENAME TO source_scores_old;
CREATE TABLE source_scores (
 id TEXT PRIMARY KEY, movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, metric TEXT NOT NULL, raw_value REAL NOT NULL,
 raw_scale REAL CHECK(raw_scale > 0), normalized_value REAL CHECK(normalized_value BETWEEN 0 AND 100),
 vote_count INTEGER CHECK(vote_count >= 0), fetched_at TEXT NOT NULL,
 import_source TEXT, import_key TEXT, retrieved_via TEXT NOT NULL DEFAULT 'unspecified', upstream_updated_at TEXT,
 UNIQUE(movie_id,provider,metric,retrieved_via,fetched_at), UNIQUE(import_source,import_key)
);
INSERT INTO source_scores SELECT * FROM source_scores_old;
DROP TABLE source_scores_old;
CREATE INDEX scores_by_movie ON source_scores(movie_id,provider,metric,retrieved_via,fetched_at);
