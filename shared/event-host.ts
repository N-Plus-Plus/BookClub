import type { Member, Rotation, Session } from './types';

export function eventHost(members: Member[], rotation: Rotation | null, initial?: Pick<Session,'kind'|'host_member_id'>): Pick<Session,'kind'|'host_member_id'> {
  if (initial) return {kind:initial.kind,host_member_id:initial.host_member_id};
  if (!rotation) throw new Error('The current turn is unavailable. Reload BookClub before recording an event.');
  if (rotation.nominal_slot === 5) return {kind:'classics',host_member_id:null};
  const member = members.find(member => member.active && member.sort_order === rotation.nominal_slot);
  if (!member) throw new Error('The current turn has no active member. Ask an administrator to correct the rotation roster.');
  return {kind:'hosted',host_member_id:member.id};
}
