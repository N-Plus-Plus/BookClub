ALTER TABLE club_rotation ADD COLUMN human_order TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(human_order) AND json_type(human_order)='object');

-- Recheck eligibility inside the write transaction, including raced events/deactivation.
CREATE TRIGGER rotation_swap_guard BEFORE UPDATE ON club_rotation
WHEN NEW.human_order <> OLD.human_order AND NEW.human_order <> '{}'
AND (OLD.nominal_slot=5 OR NOT EXISTS (
 SELECT 1 FROM members target
 WHERE target.active=1 AND target.sort_order BETWEEN 1 AND 4
 AND target.id=json_extract(NEW.human_order,'$."' || OLD.nominal_slot || '"')
 AND EXISTS (SELECT 1 FROM members original
   WHERE original.active=1 AND original.id=COALESCE(json_extract(OLD.human_order,'$."' || OLD.nominal_slot || '"'),
     (SELECT id FROM members WHERE sort_order=OLD.nominal_slot)))
 AND EXISTS (SELECT 1 FROM members position
   WHERE position.sort_order>OLD.nominal_slot AND position.sort_order<=4
   AND target.id=COALESCE(json_extract(OLD.human_order,'$."' || position.sort_order || '"'),position.id)
   AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.deleted_at IS NULL AND s.cycle_id=OLD.cycle_id
     AND (s.cycle_slot=position.sort_order OR s.host_member_id=target.id)))
))
BEGIN SELECT RAISE(ABORT,'TURN_CONFLICT'); END;

DROP TRIGGER publication_turn_advance;
CREATE TRIGGER publication_turn_advance AFTER INSERT ON sessions WHEN NEW.completed_turn_version IS NOT NULL BEGIN
 UPDATE club_rotation SET nominal_slot=CASE WHEN NEW.cycle_slot=5 THEN 1 ELSE NEW.cycle_slot+1 END,
   cycle_id=CASE WHEN NEW.cycle_slot=5 THEN NULL ELSE NEW.cycle_id END,
   human_order=CASE WHEN NEW.cycle_slot=5 THEN '{}' ELSE human_order END,version=version+1,
   updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;
