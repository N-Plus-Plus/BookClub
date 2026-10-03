-- Copy to bootstrap-members.local.sql (ignored) and replace EVERY placeholder.
-- Never apply this example or the development seed to production.
-- Stable member IDs: retain these IDs on subsequent runs; do not rebind identities.
-- Plain INSERT OR IGNORE makes an identical rerun harmless. Changes/conflicts must
-- be reviewed by the operator; this file deliberately cannot overwrite bindings.
INSERT OR IGNORE INTO members(id,display_name,sort_order) VALUES
 ('club-member-1','REPLACE_MEMBER_1_NAME',1),
 ('club-member-2','REPLACE_MEMBER_2_NAME',2),
 ('club-member-3','REPLACE_MEMBER_3_NAME',3),
 ('club-member-4','REPLACE_MEMBER_4_NAME',4);
INSERT OR IGNORE INTO member_auth(member_id,authorized_email) VALUES
 ('club-member-1','replace_member_1_email@example.invalid'),
 ('club-member-2','replace_member_2_email@example.invalid'),
 ('club-member-3','replace_member_3_email@example.invalid'),
 ('club-member-4','replace_member_4_email@example.invalid');
