-- Exceptional next-cycle exchange: Classics first, position-one human last.
-- Human order retains only real member IDs. Existing cycles keep their semantics.
ALTER TABLE club_rotation ADD COLUMN classics_first INTEGER NOT NULL DEFAULT 0 CHECK(classics_first IN (0,1));
ALTER TABLE cycles ADD COLUMN classics_first INTEGER NOT NULL DEFAULT 0 CHECK(classics_first IN (0,1));
CREATE TRIGGER cycle_identity_guard BEFORE UPDATE ON cycles
WHEN NEW.classics_first <> OLD.classics_first
BEGIN SELECT RAISE(ABORT,'HISTORY_CONFLICT'); END;
CREATE TRIGGER classics_first_guard BEFORE UPDATE ON club_rotation
WHEN NEW.classics_first <> OLD.classics_first AND NOT (
 (OLD.classics_first=0 AND NEW.classics_first=1 AND OLD.nominal_slot=1 AND NEW.nominal_slot=1
  AND OLD.cycle_id IS NULL AND NEW.cycle_id IS NULL AND NEW.human_order=OLD.human_order
  AND EXISTS(SELECT 1 FROM members m WHERE m.active=1 AND m.sort_order=1
   AND m.id=COALESCE(json_extract(OLD.human_order,'$."1"'),m.id))
  AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.completed_turn_version>=OLD.version))
 OR (OLD.classics_first=1 AND NEW.classics_first=0 AND OLD.nominal_slot=5 AND NEW.nominal_slot=1
  AND NEW.cycle_id IS NULL AND NEW.human_order='{}'
  AND EXISTS(SELECT 1 FROM sessions s WHERE s.cycle_id=OLD.cycle_id AND s.cycle_slot=5
   AND s.completed_turn_version=OLD.version AND s.deleted_at IS NULL))
)
BEGIN SELECT RAISE(ABORT,'TURN_CONFLICT'); END;

DROP TRIGGER rotation_swap_guard;
CREATE TRIGGER rotation_swap_guard BEFORE UPDATE ON club_rotation
WHEN NEW.human_order <> OLD.human_order AND NEW.human_order <> '{}'
AND NOT EXISTS (
 SELECT 1 FROM members target
 WHERE target.active=1 AND target.sort_order BETWEEN 1 AND 4
 AND target.id=json_extract(NEW.human_order,'$."' || CASE WHEN OLD.classics_first=1 AND OLD.nominal_slot=5 THEN 1 ELSE OLD.nominal_slot END || '"')
 AND OLD.nominal_slot<>CASE WHEN OLD.classics_first=1 THEN 1 ELSE 5 END
 AND EXISTS(SELECT 1 FROM members original WHERE original.active=1
   AND original.id=COALESCE(json_extract(OLD.human_order,'$."' || CASE WHEN OLD.classics_first=1 AND OLD.nominal_slot=5 THEN 1 ELSE OLD.nominal_slot END || '"'),
    (SELECT id FROM members WHERE sort_order=CASE WHEN OLD.classics_first=1 AND OLD.nominal_slot=5 THEN 1 ELSE OLD.nominal_slot END)))
 AND EXISTS(SELECT 1 FROM members position WHERE position.sort_order BETWEEN 1 AND 4
  AND position.sort_order > OLD.nominal_slot
  AND target.id=COALESCE(json_extract(OLD.human_order,'$."' || position.sort_order || '"'),position.id)
  AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.deleted_at IS NULL AND s.cycle_id=OLD.cycle_id
    AND (s.cycle_slot=CASE WHEN OLD.classics_first=1 AND position.sort_order=1 THEN 5 ELSE position.sort_order END OR s.host_member_id=target.id)))
)
BEGIN SELECT RAISE(ABORT,'TURN_CONFLICT'); END;

DROP TRIGGER publication_turn_guard;
CREATE TRIGGER publication_turn_guard BEFORE INSERT ON sessions WHEN NEW.completed_turn_version IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM club_rotation r JOIN cycles c ON c.id=NEW.cycle_id
 WHERE r.id=1 AND r.version=NEW.completed_turn_version AND r.nominal_slot=NEW.cycle_slot
 AND (r.cycle_id=NEW.cycle_id OR (r.nominal_slot=1 AND r.cycle_id IS NULL))
 AND c.classics_first=r.classics_first AND NEW.date_precision='exact'
 AND ((r.nominal_slot=CASE WHEN r.classics_first=1 THEN 1 ELSE 5 END AND NEW.kind='classics' AND NEW.host_member_id IS NULL)
  OR (r.nominal_slot<>CASE WHEN r.classics_first=1 THEN 1 ELSE 5 END AND NEW.kind='hosted'
   AND (r.classics_first=0 AND NEW.host_member_id IS NOT NULL OR EXISTS(SELECT 1 FROM members m WHERE m.active=1 AND m.id=NEW.host_member_id
    AND m.id=COALESCE(json_extract(r.human_order,'$."' || CASE WHEN r.classics_first=1 AND r.nominal_slot=5 THEN 1 ELSE r.nominal_slot END || '"'),
      (SELECT id FROM members WHERE sort_order=CASE WHEN r.classics_first=1 AND r.nominal_slot=5 THEN 1 ELSE r.nominal_slot END)))))) )
BEGIN SELECT RAISE(ABORT,'TURN_CONFLICT'); END;

DROP TRIGGER publication_turn_advance;
CREATE TRIGGER publication_turn_advance AFTER INSERT ON sessions WHEN NEW.completed_turn_version IS NOT NULL BEGIN
 UPDATE club_rotation SET nominal_slot=CASE WHEN NEW.cycle_slot=5 THEN 1 ELSE NEW.cycle_slot+1 END,
  cycle_id=CASE WHEN NEW.cycle_slot=5 THEN NULL ELSE NEW.cycle_id END,
  human_order=CASE WHEN NEW.cycle_slot=5 THEN '{}' ELSE human_order END,
  classics_first=CASE WHEN NEW.cycle_slot=5 THEN 0 ELSE classics_first END,
  version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;
