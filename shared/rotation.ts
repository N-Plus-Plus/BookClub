import type { Member, Rotation, Session } from './types';

export function effectiveMember(members: Member[], rotation: Rotation, slot = rotation.nominal_slot) {
  if (slot === 5) return undefined;
  const id = rotation.human_order?.[String(slot)];
  return members.find(member => member.active && (id ? member.id === id : member.sort_order === slot));
}

export function swapTargets(members: Member[], rotation: Rotation, sessions: Pick<Session,'cycle_id'|'cycle_slot'|'host_member_id'|'deleted_at'>[]) {
  if (rotation.nominal_slot === 5) return [];
  const events = sessions.filter(event => !event.deleted_at && rotation.cycle_id !== null && event.cycle_id === rotation.cycle_id);
  const current = effectiveMember(members,rotation);
  if (!current) return [];
  return [1,2,3,4].filter(slot => slot > rotation.nominal_slot && !events.some(event => event.cycle_slot === slot))
    .map(slot => ({slot,member:effectiveMember(members,rotation,slot)}))
    .filter((target): target is {slot:number;member:Member} => Boolean(target.member && target.member.id !== current?.id && !events.some(event => event.host_member_id === target.member!.id)));
}
