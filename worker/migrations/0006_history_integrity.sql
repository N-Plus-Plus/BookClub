-- Conflicting existing History must be reconciled explicitly before migration.
-- Soft deletion releases a nominal slot; restoration rechecks this index.
CREATE UNIQUE INDEX active_cycle_slot ON sessions(cycle_id,cycle_slot)
 WHERE cycle_id IS NOT NULL AND cycle_slot IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER session_swap_insert BEFORE INSERT ON sessions
 WHEN NEW.kind='hosted' AND NEW.cycle_slot BETWEEN 1 AND 4
 AND EXISTS(SELECT 1 FROM members WHERE sort_order=NEW.cycle_slot AND id IS NOT NEW.host_member_id)
 AND length(trim(COALESCE(NEW.swap_note,''),char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))=0
 BEGIN SELECT RAISE(ABORT,'SWAP_REQUIRED'); END;
CREATE TRIGGER session_swap_update BEFORE UPDATE ON sessions
 WHEN NEW.kind='hosted' AND NEW.cycle_slot BETWEEN 1 AND 4
 AND EXISTS(SELECT 1 FROM members WHERE sort_order=NEW.cycle_slot AND id IS NOT NEW.host_member_id)
 AND length(trim(COALESCE(NEW.swap_note,''),char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))=0
 BEGIN SELECT RAISE(ABORT,'SWAP_REQUIRED'); END;
