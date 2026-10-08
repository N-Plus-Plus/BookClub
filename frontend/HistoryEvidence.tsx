import { catalogIndex } from '../shared/catalog-index';
import type { Catalog, Rotation, Session } from '../shared/types';
import { currentTurnLabel, historicalTurnLabel, possessiveName } from './presentation';
import { dateLabel, eventDateLabel } from './components';

type Evidence = Record<string,unknown>;
const record = (value: unknown): Evidence => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Evidence : {};
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00`));

// Only known, useful evidence is presented; stored audit payloads are never changed.
export function HistoryEvidence({json,catalog}: {json: string; catalog: Catalog}) {
  let changes: Evidence;
  try { changes = record(JSON.parse(json)); }
  catch { return <p className="meta">Change details unavailable.</p>; }
  const memberName = (id: unknown) => (typeof id === 'string' ? catalogIndex(catalog).memberById.get(id)?.display_name : undefined) ?? 'Former member';
  const cycleName = (id: unknown) => { const cycle = typeof id === 'string' ? catalogIndex(catalog).cycleById.get(id) : undefined; return cycle ? cycle.title || `Cycle ${cycle.ordinal}` : id ? 'Former cycle' : 'Ungrouped'; };
  const snapshot = (value: unknown,heading: string) => {
    const data = record(value);
    if (!Object.keys(data).length) return null;
    const films = Array.isArray(data.movie_ids) ? data.movie_ids : Array.isArray(data.films) ? [...data.films].sort((a,b) => Number(record(a).position) - Number(record(b).position)).map(f => record(f).movie_id) : null;
    return <section className="stack"><h4>{heading}</h4>
      {validDate(data.event_date) && <p className="meta">Event date: {eventDateLabel({event_date:data.event_date,date_precision:(['exact','cycle_rough','unknown'].includes(String(data.date_precision)) ? data.date_precision : 'exact') as Session['date_precision']})}</p>}
      {Object.hasOwn(data,'kind') && <p className="meta">Event: {data.kind === 'classics' ? 'Classics week' : `${possessiveName(memberName(data.host_member_id))} week`}</p>}
      {Object.hasOwn(data,'host_member_id') && <p className="meta">Host: {data.host_member_id ? memberName(data.host_member_id) : 'Hostless'}</p>}
      {Object.hasOwn(data,'cycle_id') && <p className="meta">Cycle: {cycleName(data.cycle_id)}</p>}
      {Object.hasOwn(data,'cycle_slot') && <p className="meta">Historical turn: {historicalTurnLabel(typeof data.cycle_slot === 'number' ? data.cycle_slot : null,Boolean(catalog.cycles.find(c=>c.id===data.cycle_id)?.classics_first))}</p>}
      {films && <><p className="meta">Film lineup{!films.length ? ': No films' : ''}</p>{films.length > 0 && <ol>{films.map((id,i) => <li key={i}>{catalogIndex(catalog).movieById.get(id)?.title ?? 'Unavailable film'}</li>)}</ol>}</>}
      {data.complete_turn === true && <p className="meta">Current turn completed.</p>}
      {data.complete_turn === false && <p className="meta">Current turn not completed.</p>}
      {record(data.new_cycle).rough_date && validDate(record(data.new_cycle).rough_date) ? <p className="meta">New cycle anchor: {dateLabel(record(data.new_cycle).rough_date as string)}</p> : null}
    </section>;
  };
  const turn = record(changes.turn_before);
  const order = record(turn.human_order);
  const turnPosition = typeof turn.nominal_slot === 'number' ? turn.nominal_slot : null;
  const planned = typeof changes.planned_at === 'string' ? new Date(changes.planned_at) : null;
  return <div className="stack">
    <details><summary>Change evidence</summary><div className="stack">
      {snapshot(changes.before,'Before')}{snapshot(changes.after,'After')}
      {turnPosition !== null && <section className="stack"><h4>Turn before this event</h4><p className="meta">{currentTurnLabel(catalog.members,{nominal_slot:turnPosition,human_order:order,classics_first:turn.classics_first === 1 ? 1 : 0} as Rotation)} · {cycleName(turn.cycle_id)}</p>
        {(Object.keys(order).length > 0 || turn.classics_first === 1) && <><p className="meta">Cycle turn order</p><ol>{[1,2,3,4,5].map(position => <li key={position}>{currentTurnLabel(catalog.members,{nominal_slot:position,human_order:order,classics_first:turn.classics_first === 1 ? 1 : 0} as Rotation)}</li>)}</ol></>}
      </section>}
      {planned && Number.isFinite(planned.getTime()) && <p className="meta">Planned: {planned.toLocaleString('en-AU')}</p>}
      {changes.cycle_anchor_correction === true && <p className="meta">Cycle anchor corrected; reference dates follow the new anchor.</p>}
    </div></details>
    {changes.rotation_unchanged === true && <p className="meta">Rotation unchanged.</p>}
    {changes.requires_rotation_review === true && <p className="meta">This event completed a turn. An administrator should review rotation if correction is needed.</p>}
  </div>;
}
