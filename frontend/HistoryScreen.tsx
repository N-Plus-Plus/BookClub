import { useState } from 'react';
import { CalendarPlus, History, Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
import type { Session, HistoryAudit, Catalog } from '../shared/types';
import { Action, RouteLink, dateLabel, Empty, SessionCard } from './components';
export function HistoryScreen({catalog,onChanged}: {catalog: Catalog; onChanged: () => void}) {
  return <div className="stack"><RouteLink to="event" icon={CalendarPlus}>Create an event</RouteLink>{catalog.cycles.map(cycle => <section className="stack" key={cycle.id}>
    <h2>{cycle.title || `Cycle ${cycle.ordinal}`}</h2><p className="meta">Cycle anchor: {dateLabel(cycle.rough_date)} · Nominal slot order. Each event has its own date where known.</p>
    <div className="history-grid">{catalog.sessions.filter(s => s.cycle_id === cycle.id).sort((a,b) => (a.cycle_slot ?? 6)-(b.cycle_slot ?? 6) || a.id.localeCompare(b.id)).map(s => <HistoryEvent key={s.id} session={s} catalog={catalog} onChanged={onChanged} />)}</div>
  </section>)}{catalog.sessions.some(s => !s.cycle_id) && <section className="stack"><h2>Ungrouped events</h2><div className="history-grid">{catalog.sessions.filter(s => !s.cycle_id).map(s => <HistoryEvent key={s.id} session={s} catalog={catalog} onChanged={onChanged} />)}</div></section>}
    {!catalog.sessions.length && <Empty title="No events yet">Create an event to begin your journal.</Empty>}</div>;
}

function HistoryEvent({session,catalog,onChanged}: {session: Session; catalog: Catalog; onChanged: () => void}) {
  const [audit,setAudit] = useState<HistoryAudit[] | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch(e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); } };
  return <div className="stack"><SessionCard session={session} members={catalog.members} /><div className="button-set"><RouteLink to={`event/${session.id}`} icon={Pencil}>Edit</RouteLink><Action icon={History} disabled={busy} onClick={() => void run(async () => setAudit(await api.audit(session.id)))}>Audit</Action><Action icon={Trash2} disabled={busy} onClick={() => { if (window.confirm('Remove this event from History? An administrator can restore it. Rotation will remain unchanged.')) void run(async () => { await api.deleteSession(session.id); onChanged(); }); }}>Delete</Action></div>
    {audit && <section className="card stack" aria-label="Event audit"><h3>Changes to this event</h3>{!audit.length && <p className="meta">No application changes recorded. Legacy imports predate this audit trail.</p>}{audit.map(row => {
      const changes = JSON.parse(row.changes_json) as {before?: {event_date?: string; title?: string; notes?: string}; after?: {event_date?: string; title?: string; notes?: string; movie_ids?: string[]; swap_note?: string}; rotation_unchanged?: boolean; requires_rotation_review?: boolean};
      return <div className="source-record" key={row.id}><p>{row.action.toUpperCase()} · {catalog.members.find(m => m.id === row.actor_member_id)?.display_name.toUpperCase() ?? 'LOCAL DEMO'}</p><p className="meta">{new Date(row.occurred_at).toLocaleString('en-AU')}</p>{changes.after && <p className="meta">{changes.before?.event_date && `${changes.before.event_date} → `}{changes.after.event_date} · {changes.after.title || 'Untitled'} · {changes.after.movie_ids?.map(id => catalog.movies.find(m => m.id === id)?.title ?? 'Film').join(', ')}</p>}{changes.after?.swap_note && <p className="meta">Swap: {changes.after.swap_note}</p>}{changes.rotation_unchanged && <p className="meta">Rotation unchanged.</p>}{changes.requires_rotation_review && <p className="meta">This event completed a turn. An administrator should review rotation if correction is needed.</p>}</div>;
    })}</section>}{error && <p className="error-message" role="alert">{error}</p>}</div>;
}
