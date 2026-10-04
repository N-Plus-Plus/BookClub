import { useRef, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { Catalog, Movie, Rotation, Session, Viewer } from '../shared/types';
import { localToday } from '../shared/identity';
import { api, ApiClientError } from './api';
import { Action } from './components';
import { ClubIdentity } from './ClubIdentity';
import { FilmPicker } from './FilmPicker';
import { TurnFields } from './TurnFields';
import { routeEventValidation } from './event-validation';
export function EventScreen({catalog,writesEnabled,onMovie,onSaved,rotation,viewer,initial}: {catalog: Catalog; writesEnabled: boolean; onMovie: (m: Movie) => void; onSaved: (s: Session) => void; rotation: Rotation | null; viewer: Viewer | null; initial?: Session}) {
  const [date,setDate] = useState(initial?.event_date ?? localToday()), [title,setTitle] = useState(initial?.title ?? ''), [notes,setNotes] = useState(initial?.notes ?? '');
  const [host,setHost] = useState(initial?.host_member_id ?? viewer?.id ?? ''), [kind,setKind] = useState<Session['kind']>(initial?.kind ?? 'hosted');
  const [cycle,setCycle] = useState(initial?.cycle_id ?? ''), [slot,setSlot] = useState<number | null>(initial?.cycle_slot ?? null), [complete,setComplete] = useState(false);
  const [precision,setPrecision] = useState<Session['date_precision']>(initial?.date_precision ?? 'exact'), [swap,setSwap] = useState(initial?.swap_note ?? '');
  const [selected,setSelected] = useState<Movie[]>(initial?.movies ?? []), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [correctAnchor,setCorrectAnchor] = useState(false);
  const workflow = useRef<HTMLDivElement>(null);
  const formError = useRef<HTMLParagraphElement>(null);
  const [fields,setFields] = useState<Record<string,string>>({});
  const invalid = (issues: {path: string; message: string}[]) => {
    const controls = [...(workflow.current?.querySelectorAll<HTMLElement>('input[name],select[name],textarea[name],[name="movie_ids"]') ?? [])];
    const routed = routeEventValidation(issues,new Set(controls.map(control => control.getAttribute('name')!)));
    setFields(routed.fields); setError(routed.formMessage);
    requestAnimationFrame(() => {
      const invalidControls = controls.filter(control => Object.hasOwn(routed.fields,control.getAttribute('name')!));
      for (const control of invalidControls) {
        for (let parent = control.parentElement; parent && parent !== workflow.current; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
        }
      }
      const target = invalidControls.find(control => !control.hasAttribute('disabled')) ?? (routed.formMessage ? formError.current : null);
      target?.focus(); target?.scrollIntoView({block:'center'});
    });
  };
  const fieldError = (name: string) => fields[name] ? <p id={`error-${name}`} className="error-message" role="alert">{fields[name]}</p> : null;
  const anchorChanged = initial?.cycle_slot === 1 && Boolean(initial.cycle_id) && precision === 'exact' && date !== catalog.cycles.find(c => c.id === initial.cycle_id)?.rough_date;
  const nominal = catalog.members.find(m => m.sort_order === slot);
  const offTurn = kind === 'hosted' && slot !== null && slot <= 4 && host && host !== nominal?.id;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const failures: Record<string,string> = {};
    if (!date) failures.event_date = 'Choose the actual event date.';
    if (kind === 'hosted' && !host) failures.host_member_id = 'Choose the actual host.';
    if (offTurn && !swap.trim()) failures.swap_note = 'Explain the swap from the nominal host.';
    if (anchorChanged && !correctAnchor) failures.correct_anchor = 'Confirm this cycle anchor correction.';
    if (!selected.length) failures.movie_ids = 'Add at least one film.';
    if (Object.keys(failures).length) { invalid(Object.entries(failures).map(([path,message]) => ({path,message}))); return; }
    setFields({});
    setBusy(true); setError('');
    try { onSaved(await api.saveSession({event_date: date,title,notes,kind,date_precision: precision,host_member_id: kind === 'classics' ? null : host || null,movie_ids: selected.map(m => m.id),cycle_slot: slot,swap_note: swap,correct_anchor: correctAnchor,complete_turn: complete,...(complete ? {turn_version: rotation?.version} : {}),...(cycle === 'new' ? {new_cycle: {rough_date: date}} : {cycle_id: cycle || null})},initial?.id)); }
    catch (e) { if (e instanceof ApiClientError && e.fields.length) invalid(e.fields); else setError(e instanceof Error ? e.message : 'Could not save event.'); } finally { setBusy(false); }
  };
  return <div ref={workflow} className="event-workflow stack"><form id="event-form" noValidate className="stack" onSubmit={e => void save(e)}><section className="card stack"><h2>Event details</h2><label className="input-label">Actual event date<input name="event_date" aria-invalid={Boolean(fields.event_date)} aria-describedby={fields.event_date ? 'error-event_date' : undefined} className="field__input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>{fieldError('event_date')}
    {anchorChanged && <label className="host-option"><input name="correct_anchor" type="checkbox" required checked={correctAnchor} onChange={e => setCorrectAnchor(e.target.checked)} />Correct the cycle anchor to this slot-1 date. Unknown legacy reference dates will follow it; later exact event dates and rotation stay unchanged.</label>}{fieldError('correct_anchor')}
    {!initial ? <TurnFields errors={fields} catalog={catalog} rotation={rotation} complete={complete} onComplete={value => { setComplete(value); if (value && rotation) { setKind(rotation.nominal_slot === 5 ? 'classics' : 'hosted'); setPrecision('exact'); } }} cycle={cycle} onCycle={setCycle} slot={slot} onSlot={value => { setSlot(value); if (value) setKind(value === 5 ? 'classics' : 'hosted'); }} /> : <p className="meta">Editing History never advances or rewinds rotation. Published planning metadata is permanent.</p>}
    <label className="input-label">Event kind<select name="kind" aria-invalid={Boolean(fields.kind)} aria-describedby={fields.kind ? 'error-kind' : undefined} className="field__input" value={kind} disabled={complete} onChange={e => setKind(e.target.value as typeof kind)}><option value="hosted">Hosted</option><option value="classics">Classics Collection</option></select></label>{fieldError('kind')}
    {initial && <details className="utility-disclosure"><summary>Historical date precision</summary><label className="input-label">Date precision<select name="date_precision" aria-invalid={Boolean(fields.date_precision)} aria-describedby={fields.date_precision ? 'error-date_precision' : undefined} className="field__input" value={precision} onChange={e => setPrecision(e.target.value as typeof precision)}><option value="exact">Exact event date</option><option value="cycle_rough">Cycle reference - actual date unknown</option><option value="unknown">Unknown - sorting date only</option></select></label>{fieldError('date_precision')}</details>}
    <details className="utility-disclosure"><summary>Optional title & notes</summary><div className="stack"><label className="input-label">Title or theme (optional)<input name="title" aria-invalid={Boolean(fields.title)} aria-describedby={fields.title ? 'error-title' : undefined} className="field__input" maxLength={300} value={title} onChange={e => setTitle(e.target.value)} /></label>{fieldError('title')}<label className="input-label">Notes (optional)<textarea name="notes" aria-invalid={Boolean(fields.notes)} aria-describedby={fields.notes ? 'error-notes' : undefined} className="field__input" maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} /></label>{fieldError('notes')}</div></details>
    {kind === 'hosted' && <fieldset><legend>Actual host</legend><div className="host-options">{catalog.members.filter(m => m.active).map(m => <label className="host-option" key={m.id}><input type="radio" name="host_member_id" aria-invalid={Boolean(fields.host_member_id)} aria-describedby={fields.host_member_id ? 'error-host_member_id' : undefined} required checked={host === m.id} onChange={() => setHost(m.id)} /><ClubIdentity identity={{kind: 'member',member: m}} /></label>)}</div></fieldset>}{fieldError('host_member_id')}
    {offTurn && <p className="notice" role="status">The actual host differs from this nominal turn. Record the swap below; the permanent rotation stays the same.</p>}{(offTurn || Boolean(initial?.swap_note)) ? <label className="input-label">Swap explanation {offTurn ? '(required)' : '(optional)'}<textarea name="swap_note" aria-invalid={Boolean(fields.swap_note)} aria-describedby={fields.swap_note ? 'error-swap_note' : undefined} className="field__input" maxLength={2000} required={Boolean(offTurn)} value={swap} onChange={e => setSwap(e.target.value)} /></label> : <details className="utility-disclosure"><summary>Optional swap explanation</summary><textarea name="swap_note" aria-label="Swap explanation" className="field__input" maxLength={2000} value={swap} onChange={e => setSwap(e.target.value)} /></details>}{fieldError('swap_note')}
    </section></form>
    <div tabIndex={-1} aria-invalid={Boolean(fields.movie_ids)} aria-describedby={fields.movie_ids ? 'error-movie_ids' : undefined} className="stack" ref={element => { if (element) element.setAttribute('name','movie_ids'); }}>{fieldError('movie_ids')}<FilmPicker selected={selected} onSelected={setSelected} onMovie={onMovie} disabled={busy || !writesEnabled} /></div>
    <section className="stack"><h2>Review event</h2><p>{date || 'Date required'} · {kind === 'classics' ? 'CLSC' : catalog.members.find(m => m.id === host)?.display_name.toUpperCase() || 'Host required'} · {selected.length} films in viewing order</p>{error && <p ref={formError} tabIndex={-1} className="error-message" role="alert">{error}</p>}<Action form="event-form" type="submit" icon={Save} variant="primary" disabled={busy || !writesEnabled}>{busy ? 'Saving…' : initial ? 'Save corrections' : 'Save event'}</Action></section></div>;
}
