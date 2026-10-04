import type { Catalog } from '../shared/types';
import { dateLabel, Empty, SessionCard } from './components';
export function HistoryScreen({catalog}: {catalog: Catalog}) {
  return <div className="stack">{catalog.cycles.map(cycle => <section className="stack" key={cycle.id}>
    <h2>{cycle.title || `Cycle ${cycle.ordinal}`}</h2><p className="meta">Approx. {dateLabel(cycle.rough_date)} · Grouped by source slot; order within the cycle is not known chronology.</p>
    <div className="history-grid">{catalog.sessions.filter(s => s.cycle_id === cycle.id).sort((a,b) => (a.cycle_slot ?? 6)-(b.cycle_slot ?? 6) || a.id.localeCompare(b.id)).map(s => <SessionCard key={s.id} session={s} members={catalog.members} />)}</div>
  </section>)}{catalog.sessions.some(s => !s.cycle_id) && <section className="stack"><h2>Ungrouped events</h2><div className="history-grid">{catalog.sessions.filter(s => !s.cycle_id).map(s => <SessionCard key={s.id} session={s} members={catalog.members} />)}</div></section>}
    {!catalog.sessions.length && <Empty title="No events yet">Create an event to begin your journal.</Empty>}</div>;
}
