-- Additive: older jobs have no planner row and retain their frozen execution scope.
CREATE TABLE maintenance_job_planning (
  job_id TEXT PRIMARY KEY REFERENCES maintenance_jobs(id),
  stage TEXT NOT NULL CHECK(stage IN ('films','collections','complete')),
  cursor INTEGER NOT NULL DEFAULT 0 CHECK(cursor>=0),
  total INTEGER NOT NULL DEFAULT 0 CHECK(total>=0),
  failed INTEGER NOT NULL DEFAULT 0 CHECK(failed IN (0,1)),
  diagnostic TEXT,
  legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN (0,1)),
  CHECK(stage<>'complete' OR cursor=total)
);
CREATE TABLE maintenance_job_candidates (
  job_id TEXT NOT NULL REFERENCES maintenance_jobs(id),
  phase TEXT NOT NULL CHECK(phase IN ('films','collections')),
  ordinal INTEGER NOT NULL,
  movie_id TEXT,
  collection_id INTEGER,
  legacy_unit TEXT CHECK(legacy_unit IS NULL OR json_valid(legacy_unit)),
  PRIMARY KEY(job_id,phase,ordinal),
  CHECK((movie_id IS NOT NULL AND collection_id IS NULL) OR (movie_id IS NULL AND collection_id IS NOT NULL))
);
CREATE TRIGGER maintenance_planning_execution_gate BEFORE UPDATE OF state ON maintenance_jobs
WHEN NEW.state IN ('ready','running','completed','completed_with_issues') AND EXISTS(
  SELECT 1 FROM maintenance_job_planning WHERE job_id=NEW.id AND stage<>'complete'
)
BEGIN SELECT RAISE(ABORT,'MAINTENANCE_PLANNING_INCOMPLETE'); END;
