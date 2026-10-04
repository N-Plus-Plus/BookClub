-- Successful explicit enrichment is complete even when TMDB omits optional fields.
-- Existing films remain unchecked; never infer completion from metadata coverage.
ALTER TABLE movies ADD COLUMN tmdb_metadata_checked_at TEXT;
