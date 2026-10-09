CREATE TABLE maintenance_jobs (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL CHECK(intent IN ('populate','refresh')),
  operation TEXT NOT NULL CHECK(operation IN ('all','scores','omdb-metadata','tmdb-metadata','tmdb-enrichment','mdblist-enrichment','tmdb-collections','omdb-awards','collection-rosters')),
  started_at TEXT NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('films','collections')),
  state TEXT NOT NULL CHECK(state IN ('ready','running','paused','awaiting_cooldown','completed','completed_with_issues','failed','cancelled')),
  include_rosters INTEGER NOT NULL CHECK(include_rosters IN (0,1)),
  roster_started_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  provider TEXT CHECK(provider IS NULL OR provider IN ('omdb','tmdb','mdblist')),
  diagnostic TEXT,
  stop_requested INTEGER NOT NULL DEFAULT 0 CHECK(stop_requested IN (0,1))
);
CREATE INDEX maintenance_jobs_recent ON maintenance_jobs(updated_at DESC,id);
CREATE INDEX maintenance_jobs_history ON maintenance_jobs(created_at DESC,id);
CREATE TABLE maintenance_job_units (
  job_id TEXT NOT NULL REFERENCES maintenance_jobs(id),
  key TEXT NOT NULL,
  movie_id TEXT,
  collection_id INTEGER,
  provider TEXT NOT NULL CHECK(provider IN ('omdb','tmdb','mdblist')),
  identity_provider TEXT,
  external_id TEXT,
  operations_json TEXT NOT NULL CHECK(json_valid(operations_json) AND length(operations_json)<1000),
  score_keys_json TEXT NOT NULL CHECK(json_valid(score_keys_json) AND length(score_keys_json)<1000),
  status TEXT NOT NULL CHECK(status IN ('pending','running','successful','skipped','deferred','blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  checked_at TEXT,
  outcome TEXT,
  failure_category TEXT CHECK(failure_category IS NULL OR failure_category IN ('record','transient','provider','systemic','ambiguous')),
  diagnostic TEXT,
  retry_at TEXT,
  PRIMARY KEY(job_id,key),
  CHECK((movie_id IS NOT NULL AND collection_id IS NULL AND identity_provider IS NOT NULL AND external_id IS NOT NULL) OR (movie_id IS NULL AND collection_id IS NOT NULL))
);
CREATE INDEX maintenance_job_queue ON maintenance_job_units(job_id,status,provider,key);
CREATE TABLE maintenance_lease (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  job_id TEXT,
  owner TEXT,
  token TEXT,
  expires_at INTEGER NOT NULL DEFAULT 0,
  execution TEXT
);
INSERT INTO maintenance_lease(slot) VALUES(1);
-- An assertion joins each destination write transaction. A stale execution cannot
-- commit provider evidence or progress after another client takes ownership.
CREATE TABLE maintenance_write_guard(slot INTEGER PRIMARY KEY CHECK(slot=1),job_id TEXT NOT NULL,token TEXT NOT NULL,execution TEXT NOT NULL);
CREATE TRIGGER maintenance_write_guard_insert BEFORE INSERT ON maintenance_write_guard
WHEN NOT EXISTS(SELECT 1 FROM maintenance_lease WHERE slot=1 AND job_id=NEW.job_id AND token=NEW.token AND execution=NEW.execution AND expires_at>unixepoch()*1000)
BEGIN SELECT RAISE(ABORT,'MAINTENANCE_LEASE_LOST'); END;
CREATE TRIGGER maintenance_write_guard_update BEFORE UPDATE ON maintenance_write_guard
WHEN NOT EXISTS(SELECT 1 FROM maintenance_lease WHERE slot=1 AND job_id=NEW.job_id AND token=NEW.token AND execution=NEW.execution AND expires_at>unixepoch()*1000)
BEGIN SELECT RAISE(ABORT,'MAINTENANCE_LEASE_LOST'); END;
