-- Add authority without changing any existing title or immutable source evidence.
ALTER TABLE movies ADD COLUMN title_source TEXT NOT NULL DEFAULT 'manual'
 CHECK(title_source IN ('omdb','tmdb','mdblist','manual','legacy-spreadsheet'));
UPDATE movies SET title_source='legacy-spreadsheet' WHERE import_source='legacy-spreadsheet';
CREATE TRIGGER movie_title_fallback_insert AFTER INSERT ON movies
 WHEN NEW.import_source='legacy-spreadsheet' AND NEW.title_source='manual'
 BEGIN UPDATE movies SET title_source='legacy-spreadsheet' WHERE id=NEW.id; END;
