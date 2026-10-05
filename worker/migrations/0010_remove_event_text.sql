-- Remove explanation-only guards; actual hosts may differ from nominal hosts.
DROP TRIGGER session_swap_insert;
DROP TRIGGER session_swap_update;

-- D1 supports SQLite DROP COLUMN; these fields have no remaining schema references.
-- Keep the sessions table, its relationships, indexes and publication triggers intact.
ALTER TABLE sessions DROP COLUMN title;
ALTER TABLE sessions DROP COLUMN notes;
ALTER TABLE sessions DROP COLUMN swap_note;

-- Remove obsolete event text from existing audit snapshots as well.
UPDATE history_audit SET changes_json=json_remove(changes_json,
  '$.before.title','$.before.notes','$.before.swap_note',
  '$.after.title','$.after.notes','$.after.swap_note')
WHERE json_type(changes_json,'$.before.title') IS NOT NULL
   OR json_type(changes_json,'$.before.notes') IS NOT NULL
   OR json_type(changes_json,'$.before.swap_note') IS NOT NULL
   OR json_type(changes_json,'$.after.title') IS NOT NULL
   OR json_type(changes_json,'$.after.notes') IS NOT NULL
   OR json_type(changes_json,'$.after.swap_note') IS NOT NULL;
