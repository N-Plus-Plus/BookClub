ALTER TABLE members ADD COLUMN avatar INTEGER CHECK(avatar IS NULL OR (typeof(avatar)='integer' AND avatar BETWEEN 0 AND 19));
CREATE UNIQUE INDEX member_avatar_unique ON members(avatar) WHERE avatar IS NOT NULL;
ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'));

CREATE TABLE club_rotation (
 id INTEGER PRIMARY KEY CHECK(id=1), cycle_id TEXT REFERENCES cycles(id),
 nominal_slot INTEGER NOT NULL CHECK(nominal_slot BETWEEN 1 AND 5),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((nominal_slot=1 AND cycle_id IS NULL) OR (nominal_slot>1 AND cycle_id IS NOT NULL))
);
-- Deliberately no installation-wide current turn. Private setup initialises it.
CREATE TRIGGER rotation_version_guard BEFORE UPDATE ON club_rotation WHEN NEW.version<>OLD.version+1
 BEGIN SELECT RAISE(ABORT,'TURN_CONFLICT'); END;
CREATE TABLE builder_sets (
 id TEXT PRIMARY KEY, owner_member_id TEXT NOT NULL REFERENCES members(id), title TEXT, notes TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE INDEX builders_by_owner ON builder_sets(owner_member_id,updated_at);
CREATE TRIGGER builder_revision_guard BEFORE UPDATE ON builder_sets
 WHEN NEW.revision<>OLD.revision+1 OR NEW.owner_member_id<>OLD.owner_member_id OR NEW.created_at<>OLD.created_at
 BEGIN SELECT RAISE(ABORT,'BUILDER_CONFLICT'); END;
CREATE TABLE builder_movies (
 builder_id TEXT NOT NULL REFERENCES builder_sets(id) ON DELETE CASCADE,
 movie_id TEXT NOT NULL REFERENCES movies(id), position INTEGER NOT NULL CHECK(position>0),
 PRIMARY KEY(builder_id,position)
);
ALTER TABLE sessions ADD COLUMN planned_at TEXT;
ALTER TABLE sessions ADD COLUMN published_by TEXT REFERENCES members(id);
ALTER TABLE sessions ADD COLUMN builder_id TEXT;
ALTER TABLE sessions ADD COLUMN builder_revision INTEGER;
CREATE UNIQUE INDEX published_builder ON sessions(builder_id) WHERE builder_id IS NOT NULL;
ALTER TABLE sessions ADD COLUMN completed_turn_version INTEGER;
CREATE UNIQUE INDEX completed_turn_once ON sessions(completed_turn_version) WHERE completed_turn_version IS NOT NULL;
ALTER TABLE sessions ADD COLUMN swap_note TEXT;
ALTER TABLE sessions ADD COLUMN deleted_at TEXT;
ALTER TABLE sessions ADD COLUMN deleted_by TEXT REFERENCES members(id);
CREATE TABLE history_audit (
 id TEXT PRIMARY KEY, actor_member_id TEXT REFERENCES members(id), session_id TEXT REFERENCES sessions(id),
 action TEXT NOT NULL CHECK(action IN ('create','edit','delete','restore','rotation')),
 occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 changes_json TEXT NOT NULL CHECK(json_valid(changes_json))
);
CREATE INDEX audit_by_session ON history_audit(session_id,occurred_at);

-- Transaction-time checks protect publication from concurrent edits/completions.
CREATE TRIGGER publication_builder_guard BEFORE INSERT ON sessions WHEN NEW.builder_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM builder_sets b WHERE b.id=NEW.builder_id
   AND b.owner_member_id=NEW.published_by AND b.revision=NEW.builder_revision AND b.created_at=NEW.planned_at)
 THEN RAISE(ABORT,'BUILDER_CONFLICT') END;
END;
CREATE TRIGGER publication_turn_guard BEFORE INSERT ON sessions WHEN NEW.completed_turn_version IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM club_rotation r WHERE r.id=1 AND r.version=NEW.completed_turn_version
   AND r.nominal_slot=NEW.cycle_slot AND (r.cycle_id=NEW.cycle_id OR (r.nominal_slot=1 AND r.cycle_id IS NULL))
   AND NEW.date_precision='exact' AND NEW.cycle_id IS NOT NULL
   AND ((r.nominal_slot=5 AND NEW.kind='classics' AND NEW.host_member_id IS NULL)
     OR (r.nominal_slot<5 AND NEW.kind='hosted' AND NEW.host_member_id IS NOT NULL)))
 THEN RAISE(ABORT,'TURN_CONFLICT') END;
END;
CREATE TRIGGER publication_turn_advance AFTER INSERT ON sessions WHEN NEW.completed_turn_version IS NOT NULL BEGIN
 UPDATE club_rotation SET nominal_slot=CASE WHEN NEW.cycle_slot=5 THEN 1 ELSE NEW.cycle_slot+1 END,
   cycle_id=CASE WHEN NEW.cycle_slot=5 THEN NULL ELSE NEW.cycle_id END,version=version+1,
   updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;
CREATE TRIGGER publication_builder_remove AFTER INSERT ON sessions WHEN NEW.builder_id IS NOT NULL BEGIN
 DELETE FROM builder_sets WHERE id=NEW.builder_id;
END;
CREATE TRIGGER preserve_planning_metadata BEFORE UPDATE ON sessions
 WHEN NEW.planned_at IS NOT OLD.planned_at OR NEW.published_by IS NOT OLD.published_by
   OR NEW.builder_id IS NOT OLD.builder_id OR NEW.builder_revision IS NOT OLD.builder_revision
   OR NEW.completed_turn_version IS NOT OLD.completed_turn_version
 BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PUBLICATION'); END;
CREATE TRIGGER deleted_session_guard BEFORE UPDATE ON sessions
 WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'HISTORY_CONFLICT'); END;
