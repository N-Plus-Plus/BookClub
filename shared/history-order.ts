import type { Catalog, Session } from './types';

const position = (s:Session) => s.cycle_slot != null && s.cycle_slot >= 1 && s.cycle_slot <= 5 ? s.cycle_slot : 6;
export function orderedCycleEvents(events:Session[],oldestFirst:boolean) {
  return events.filter(s=>!s.deleted_at).sort((a,b)=>(position(a)-position(b) || a.event_date.localeCompare(b.event_date) || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))*(oldestFirst ? 1 : -1));
}
/** Complete recorded cycle context, independent of a host filter; no nominal roster inference. */
export function cycleHostSequence(catalog:Catalog,cycleId:string) {
  return orderedCycleEvents(catalog.sessions.filter(s=>s.cycle_id === cycleId),true).map(s=>({id:s.id,label:s.kind === 'classics' ? 'Classics' : catalog.members.find(m=>m.id === s.host_member_id)?.display_name ?? 'Host unknown',positionKnown:position(s) !== 6}));
}
