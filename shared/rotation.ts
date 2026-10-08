import type { Member, Rotation, Session } from './types';

/** Human assignments remain keyed by permanent positions; no synthetic Classics member. */
export const humanPosition = (rotation: Rotation,slot: number) => rotation.classics_first && slot === 5 ? 1 : slot;
export const isClassicsTurn = (rotation: Pick<Rotation,'classics_first'|'nominal_slot'>,slot = rotation.nominal_slot) => slot === (rotation.classics_first ? 1 : 5);
export function canSwapClassics(members: Member[],rotation: Rotation,sessions: Pick<Session,'cycle_id'|'deleted_at'|'completed_turn_version'>[]) {
  return !rotation.classics_first && rotation.nominal_slot === 1 && rotation.cycle_id === null && effectiveMember(members,rotation)?.sort_order === 1
    && !sessions.some(event => event.completed_turn_version != null && event.completed_turn_version >= rotation.version);
}
export function effectiveMember(members: Member[], rotation: Rotation, slot = rotation.nominal_slot) {
  if (isClassicsTurn(rotation,slot)) return undefined;
  slot = humanPosition(rotation,slot);
  const id = rotation.human_order?.[String(slot)];
  return members.find(member => member.active && (id ? member.id === id : member.sort_order === slot));
}

export function swapTargets(members: Member[], rotation: Rotation, sessions: Pick<Session,'cycle_id'|'cycle_slot'|'host_member_id'|'deleted_at'>[]) {
  if (isClassicsTurn(rotation)) return [];
  const events = sessions.filter(event => !event.deleted_at && rotation.cycle_id !== null && event.cycle_id === rotation.cycle_id);
  const current = effectiveMember(members,rotation);
  if (!current) return [];
  return [1,2,3,4].filter(slot => slot > rotation.nominal_slot && !events.some(event => event.cycle_slot === slot))
    .map(slot => ({slot,member:effectiveMember(members,rotation,slot)}))
    .filter((target): target is {slot:number;member:Member} => Boolean(target.member && target.member.id !== current?.id && !events.some(event => event.host_member_id === target.member!.id)));
}
