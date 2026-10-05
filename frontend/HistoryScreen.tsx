import { HistoryEvidence } from './HistoryEvidence';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, History, Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
import type { Session, HistoryAudit, Catalog, Viewer } from '../shared/types';
import { Action, dateLabel, Empty, SessionCard } from './components';
export function HistoryScreen({catalog,viewer,onChanged}: {catalog: Catalog; viewer: Viewer | null; onChanged: () => void}) {
  const [host,setHost] = useState('all');
  const [page,setPage] = useState(1), [jump,setJump] = useState<string | null>(null);
  const visible = catalog.sessions.filter(s => host === 'all' || (host === 'classics' ? s.kind === 'classics' : s.host_member_id === host));
  const cycles = catalog.cycles.filter(c => visible.some(s => s.cycle_id === c.id));
  const pageCount = Math.max(1,Math.ceil(cycles.length / 5));
  const currentPage = Math.min(page,pageCount);
  useEffect(() => {
    if (jump) { document.getElementById(`cycle-${jump}`)?.scrollIntoView(); setJump(null); }
  },[jump,currentPage]);
  const pagination = cycles.length > 0 && <div className="button-set history-pagination" role="group" aria-label="History pagination"><Action icon={ChevronLeft} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Action><span className="meta">Page {currentPage} of {pageCount}</span><Action icon={ChevronRight} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Action></div>;
  return <div className="stack history-archive"><div className="archive-tools"><label className="input-label">Jump to cycle<select className="field__input" defaultValue="" onChange={e => { const index = cycles.findIndex(c => c.id === e.target.value); if (index >= 0) { setPage(Math.floor(index / 5) + 1); setJump(e.target.value); } e.target.value = ''; }}><option value="">Choose cycle</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.title || `Cycle ${c.ordinal}`}</option>)}</select></label><label className="input-label">Actual host<select className="field__input" value={host} onChange={e => { setHost(e.target.value); setPage(1); setJump(null); }}><option value="all">All hosts</option>{catalog.members.map(m => <option key={m.id} value={m.id}>{m.display_name.toUpperCase()}</option>)}<option value="classics">CLSC</option></select></label></div>{pagination}{cycles.slice((currentPage - 1) * 5,currentPage * 5).map(cycle => <section className="stack" key={cycle.id} id={`cycle-${cycle.id}`}>
    <h2>{cycle.title || `Cycle ${cycle.ordinal}`}</h2><p className="meta history-cycle-context"><span>Cycle starting: {dateLabel(cycle.rough_date)}</span><span className="history-cycle-order" aria-label="Turn order: Sean, Troy, Matt, Jess, Classics">{['Sean','Troy','Matt','Jess','Classics'].map((name,i) => <span className="history-cycle-turn" key={name}>{i > 0 && <ArrowRight size={14} aria-hidden="true" />}{name}</span>)}</span></p>
    <div className="history-grid">{visible.filter(s => s.cycle_id === cycle.id).sort((a,b) => (a.cycle_slot ?? 6)-(b.cycle_slot ?? 6) || a.id.localeCompare(b.id)).map(s => <HistoryEvent key={s.id} session={s} viewer={viewer} catalog={catalog} onChanged={onChanged} />)}</div>
  </section>)}{pagination}{currentPage === pageCount && visible.some(s => !s.cycle_id) && <section className="stack"><h2>Ungrouped events</h2><div className="history-grid">{visible.filter(s => !s.cycle_id).map(s => <HistoryEvent key={s.id} session={s} viewer={viewer} catalog={catalog} onChanged={onChanged} />)}</div></section>}
    {catalog.sessions.length > 0 && !visible.length && <Empty title="No events for this host">Choose another host or All hosts.</Empty>}{!catalog.sessions.length && <Empty title="No events yet">Create an event to begin your journal.</Empty>}</div>;
}

function HistoryEvent({session,catalog,viewer,onChanged}: {session: Session; catalog: Catalog; viewer: Viewer | null; onChanged: () => void}) {
  const admin = viewer?.role === 'admin';
  const canEdit = admin || Boolean(viewer && session.kind === 'hosted' && session.host_member_id === viewer.id);
  const canAudit = admin && session.has_audit === true;
  const [auditOpen,setAuditOpen] = useState(false);
  const [audit,setAudit] = useState<HistoryAudit[] | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch(e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); } };
  return <div className="stack history-event"><SessionCard variant="history" session={session} members={catalog.members} actions={<>{canEdit && <a className="button button--icon" data-variant="secondary" href={`#/event/${session.id}`} aria-label="Edit event" title="Edit event"><Pencil size={18} aria-hidden="true" /></a>}{canAudit && <Action aria-label="Audit event" title="Audit event" icon={History} variant="tertiary" aria-expanded={auditOpen} aria-controls={`audit-${session.id}`} disabled={busy && !auditOpen} onClick={() => { setAuditOpen(!auditOpen); if (!auditOpen && !audit) void run(async () => setAudit(await api.audit(session.id))); }} />}{admin && <Action aria-label="Delete event" title="Delete event" icon={Trash2} variant="danger" disabled={busy} onClick={() => { if (window.confirm('Remove this event from History? An administrator can restore it. Rotation will remain unchanged.')) void run(async () => { await api.deleteSession(session.id); onChanged(); }); }} />}</>} />
    {canAudit && auditOpen && <section id={`audit-${session.id}`} className="audit-inline stack" aria-label="Event audit"><h3>Changes to this event</h3>{audit && !audit.length && <p className="meta">No application changes recorded. Legacy imports predate this audit trail.</p>}{audit?.map(row => {
      return <div className="source-record" key={row.id}><p>{row.action.replaceAll('_',' ')} · {catalog.members.find(m => m.id === row.actor_member_id)?.display_name.toUpperCase() ?? 'LOCAL DEMO'}</p><p className="meta">{new Date(row.occurred_at).toLocaleString('en-AU')}</p><HistoryEvidence json={row.changes_json} catalog={catalog} /></div>;
    })}</section>}{error && <p className="error-message" role="alert">{error}</p>}</div>;
}
