-- Collection-level provider evidence; no catalogue or History records are created.
CREATE TABLE tmdb_collection_rosters (
  collection_id INTEGER PRIMARY KEY CHECK(collection_id > 0),
  name TEXT,
  checked_at TEXT,
  parts_json TEXT,
  attempted_at TEXT NOT NULL,
  attempt_status TEXT NOT NULL CHECK(attempt_status IN ('checked','inconclusive','failed')),
  CHECK ((checked_at IS NULL AND name IS NULL AND parts_json IS NULL)
    OR (checked_at IS NOT NULL AND name IS NOT NULL AND length(trim(name)) > 0
      AND parts_json IS NOT NULL AND json_valid(parts_json) AND json_type(parts_json) = 'array' AND json_array_length(parts_json) > 0))
);
