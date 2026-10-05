-- A successful details response checks both poster and backdrop, even if absent.
-- Do not infer this from a legacy metadata timestamp or existing partial assets.
ALTER TABLE movies ADD COLUMN tmdb_artwork_checked_at TEXT;
