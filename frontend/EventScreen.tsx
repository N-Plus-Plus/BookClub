import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { Catalog, Movie, Rotation, Session, Viewer } from '../shared/types';
import { localToday } from '../shared/identity';
import { api } from './api';
import { Action } from './components';
import { ClubIdentity } from './ClubIdentity';
import { FilmPicker } from './FilmPicker';
import { TurnFields } from './TurnFields';
export function EventScreen({catalog,writesEnabled,onMovie,onSaved,rotation,viewer,initial}: {catalog: Catalog; writesEnabled: boolean; onMovie: (m: Movie) => void; onSaved: (s: Session) => void; rotation: Rotation | null; viewer: Viewer | null; initial?: Session}) {
  const [date,setDate] = useState(initial?.event_date ?? localToday()), [title,setTitle] = useState(initial?.title ?? ''), [notes,setNotes] = useState(initial?.notes ?? '');
  const [host,setHost] = useState(initial?.host_member_id ?? viewer?.id ?? ''), [kind,setKind] = useState<Session['kind']>(initial?.kind ?? 'hosted');
  const [cycle,setCycle] = useState(initial?.cycle_id ?? ''), [slot,setSlot] = useState<number | null>(initial?.cycle_slot ?? null), [complete,setComplete] = useState(false);
  const [precision,setPrecision] = useState<Session['date_precision']>(initial?.date_precision ?? 'exact'), [swap,setSwap] = useState(initial?.swap_note ?? '');
  const [selected,setSelected] = useState<Movie[]>(initial?.movies ?? []), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [correctAnchor,setCorrectAnchor] = useState(false);
  const anchorChanged = initial?.cycle_slot === 1 && Boolean(initial.cycle_id) && precision === 'exact' && date !== catalog.cycles.find(c => c.id === initial.cycle_id)?.rough_date;
  const nominal = catalog.members.find(m => m.sort_order === slot);
  const offTurn = complete && slot !== 5 && host && host !== nominal?.id;
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!selected.length) { setError('Add at least one film.'); return; }
    setBusy(true); setError('');
    try { onSaved(await api.saveSession({event_date: date,title,notes,kind,date_precision: precision,host_member_id: kind === 'classics' ? null : host || null,movie_ids: selected.map(m => m.id),cycle_slot: slot,swap_note: swap,correct_anchor: correctAnchor,complete_turn: complete,...(complete ? {turn_version: rotation?.version} : {}),...(cycle === 'new' ? {new_cycle: {rough_date: date}} : {cycle_id: cycle || null})},initial?.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save event.'); } finally { setBusy(false); }
  };
  return <div className="event-grid"><section className="card stack"><p className="eyebrow">{initial ? 'CORRECT HISTORY' : 'THE NIGHT'}</p><h2>Event details</h2><form className="stack" onSubmit={e => void save(e)}><label className="input-label">Actual event date<input className="field__input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
    {anchorChanged && <label className="host-option"><input type="checkbox" required checked={correctAnchor} onChange={e => setCorrectAnchor(e.target.checked)} />Correct the cycle anchor to this slot-1 date. Unknown legacy reference dates will follow it; later exact event dates and rotation stay unchanged.</label>}
    {!initial ? <TurnFields catalog={catalog} rotation={rotation} complete={complete} onComplete={value => { setComplete(value); if (value && rotation) { setKind(rotation.nominal_slot === 5 ? 'classics' : 'hosted'); setPrecision('exact'); } }} cycle={cycle} onCycle={setCycle} slot={slot} onSlot={value => { setSlot(value); if (value) setKind(value === 5 ? 'classics' : 'hosted'); }} /> : <p className="meta">Editing History never advances or rewinds rotation. Published planning metadata is permanent.</p>}
    <label className="input-label">Event kind<select className="field__input" value={kind} disabled={complete} onChange={e => setKind(e.target.value as typeof kind)}><option value="hosted">Hosted</option><option value="classics">Classics Collection</option></select></label>
    {initial && <label className="input-label">Date precision<select className="field__input" value={precision} onChange={e => setPrecision(e.target.value as typeof precision)}><option value="exact">Exact event date</option><option value="cycle_rough">Cycle reference - actual date unknown</option><option value="unknown">Unknown - sorting date only</option></select></label>}
    <label className="input-label">Title or theme (optional)<input className="field__input" maxLength={300} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="input-label">Notes (optional)<textarea className="field__input" maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    {kind === 'hosted' && <fieldset><legend>Actual host</legend><div className="host-options">{catalog.members.filter(m => m.active).map(m => <label className="host-option" key={m.id}><input type="radio" name="host" required checked={host === m.id} onChange={() => setHost(m.id)} /><ClubIdentity identity={{kind: 'member',member: m}} /></label>)}</div></fieldset>}
    {offTurn && <p className="notice" role="status">The actual host differs from this nominal turn. Record the swap below; the permanent rotation stays the same.</p>}<label className="input-label">Swap explanation {offTurn ? '(required)' : '(optional)'}<textarea className="field__input" maxLength={2000} required={Boolean(offTurn)} value={swap} onChange={e => setSwap(e.target.value)} /></label>
    {error && <p className="error-message" role="alert">{error}</p>}<Action type="submit" icon={Save} intent="constructive" disabled={busy || !writesEnabled}>{busy ? 'Saving…' : initial ? 'Save corrections' : 'Save event'}</Action></form></section><FilmPicker selected={selected} onSelected={setSelected} onMovie={onMovie} disabled={busy || !writesEnabled} /></div>;
}
