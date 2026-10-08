import type { JournalMutationReader } from './useBookClubData';
import { catalogIndex } from '../shared/catalog-index';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import type { JournalMutationResult, Catalog, FilmCandidate, Movie, Rotation, Session, TmdbPreview, Viewer } from '../shared/types';
import { localToday } from '../shared/identity';
import { api, ApiClientError } from './api';
import { Action } from './components';
import { eventHost } from '../shared/event-host';
import { FilmPicker } from './FilmPicker';
import { TurnFields } from './TurnFields';
import { routeEventValidation } from './event-validation';
export function EventScreen({catalog,writesEnabled,onMovie,onSaved,readJournalMutation = operation=>operation(),rotation,initial,prefillMovieIds,onPrefillConsumed,onInspect,confirmedMovie,onConfirmedConsumed}: {catalog: Catalog; writesEnabled: boolean; onMovie: (m: Movie) => void; onSaved: (s: JournalMutationResult) => void;readJournalMutation?:JournalMutationReader; rotation: Rotation | null; viewer: Viewer | null; initial?: Session; prefillMovieIds?: string[] | null; onPrefillConsumed?: () => void; onInspect?: (candidate: FilmCandidate, preview?: TmdbPreview, pending?: Promise<TmdbPreview>) => void; confirmedMovie?: Movie | null; onConfirmedConsumed?: () => void}) {
  const [date,setDate] = useState(initial?.event_date ?? localToday());
  const [cycle,setCycle] = useState(initial ? initial.cycle_id ?? '' : rotation?.cycle_id ?? ''), [slot,setSlot] = useState<number | null>(initial ? initial.cycle_slot : rotation?.nominal_slot ?? null), [complete,setComplete] = useState(!initial);
  const [precision,setPrecision] = useState<Session['date_precision']>(initial?.date_precision ?? 'exact');
  const [selected,setSelected] = useState<Movie[]>(() => initial?.movies ?? (prefillMovieIds ?? []).flatMap(id => { const movie = catalogIndex(catalog).movieById.get(id); return movie ? [movie] : []; })), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const prefillSeeded = useRef(!initial && Boolean(prefillMovieIds));
  useEffect(() => { if (prefillSeeded.current) { prefillSeeded.current = false; onPrefillConsumed?.(); } },[onPrefillConsumed]);
  const consumedMovie = useRef<Movie | null>(null);
  useEffect(() => {
    if (!confirmedMovie) { consumedMovie.current = null; return; }
    if (confirmedMovie && consumedMovie.current !== confirmedMovie) {
      consumedMovie.current = confirmedMovie; setSelected(current => [...current,confirmedMovie]); onConfirmedConsumed?.();
    }
  },[confirmedMovie,onConfirmedConsumed]);
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
  const anchorChanged = initial?.cycle_slot === 1 && Boolean(initial.cycle_id) && precision === 'exact' && date !== catalogIndex(catalog).cycleById.get(initial.cycle_id ?? '')?.rough_date;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const failures: Record<string,string> = {};
    if (!date) failures.event_date = 'Choose the actual event date.';
    if (anchorChanged && !correctAnchor) failures.correct_anchor = 'Confirm this cycle anchor correction.';
    if (!selected.length) failures.movie_ids = 'Add at least one film.';
    if (Object.keys(failures).length) { invalid(Object.entries(failures).map(([path,message]) => ({path,message}))); return; }
    setFields({});
    setBusy(true); setError('');
    try { const identity = eventHost(catalog.members,rotation,initial); onSaved(await readJournalMutation(()=>api.saveSession({event_date: date,...identity,date_precision: precision,movie_ids: selected.map(m => m.id),cycle_slot: slot,correct_anchor: correctAnchor,complete_turn: complete,...(complete ? {turn_version: rotation?.version} : {}),...(cycle === 'new' ? {new_cycle: {rough_date: date}} : {cycle_id: cycle || null})},initial?.id))); }
    catch (e) { if (e instanceof ApiClientError && e.fields.length) invalid(e.fields); else setError(e instanceof Error ? e.message : 'Could not save event.'); } finally { setBusy(false); }
  };
  return <div ref={workflow} className="event-workflow stack"><form id="event-form" noValidate className="stack" onSubmit={e => void save(e)}><section className="card stack"><label className="input-label">Actual event date<input name="event_date" aria-invalid={Boolean(fields.event_date)} aria-describedby={fields.event_date ? 'error-event_date' : undefined} className="field__input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>{fieldError('event_date')}
    <label className="host-option"><input type="checkbox" checked={initial ? initial.completed_turn_version != null : complete} disabled={Boolean(initial)} onChange={e => { const value = e.target.checked; setComplete(value); if (value && rotation) { setCycle(rotation.cycle_id ?? ''); setSlot(rotation.nominal_slot); setPrecision('exact'); } }} />Complete the current turn</label>
    </section><section className="stack">
    {anchorChanged && <label className="host-option"><input name="correct_anchor" type="checkbox" required checked={correctAnchor} onChange={e => setCorrectAnchor(e.target.checked)} />Use this Sean's turn event date as the cycle anchor. Unknown legacy reference dates will follow it; later exact event dates and rotation stay unchanged.</label>}{fieldError('correct_anchor')}
    {!initial ? <TurnFields showCompletion={false} errors={fields} catalog={catalog} rotation={rotation} complete={complete} onComplete={value => { setComplete(value); if (value && rotation) { setPrecision('exact'); } }} cycle={cycle} onCycle={setCycle} slot={slot} onSlot={setSlot} /> : <p className="meta">Editing History never advances or rewinds rotation. Published planning metadata is permanent.</p>}
    {initial && <details className="utility-disclosure"><summary>Historical date precision</summary><label className="input-label">Date precision<select name="date_precision" aria-invalid={Boolean(fields.date_precision)} aria-describedby={fields.date_precision ? 'error-date_precision' : undefined} className="field__input" value={precision} onChange={e => setPrecision(e.target.value as typeof precision)}><option value="exact">Exact event date</option><option value="cycle_rough">Cycle started</option><option value="unknown">Unknown - sorting date only</option></select></label>{fieldError('date_precision')}</details>}
    </section></form>
    <div tabIndex={-1} aria-invalid={Boolean(fields.movie_ids)} aria-describedby={fields.movie_ids ? 'error-movie_ids' : undefined} className="stack" ref={element => { if (element) element.setAttribute('name','movie_ids'); }}>{fieldError('movie_ids')}<FilmPicker movieById={catalogIndex(catalog).movieById} selected={selected} onSelected={setSelected} onMovie={onMovie} onInspect={onInspect} disabled={busy || !writesEnabled} /></div>
    <div className="stack">{error && <p ref={formError} tabIndex={-1} className="error-message" role="alert">{error}</p>}<Action form="event-form" type="submit" icon={Save} variant="primary" disabled={busy || !writesEnabled}>{busy ? 'Saving…' : initial ? 'Save corrections' : 'Save event'}</Action></div></div>;
}
