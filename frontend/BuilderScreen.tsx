import { formatCount } from '../shared/format';
import type { JournalMutationReader } from './useBookClubData';
import { catalogIndex } from '../shared/catalog-index';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ArrowLeft, Film, CalendarCheck, Check, Save, Trash2 } from 'lucide-react';
import type { JournalMutationResult, BuilderSet, Catalog, FilmCandidate, Movie, Rotation, TmdbPreview, Viewer } from '../shared/types';
import { effectiveMember } from '../shared/rotation';
import { localToday } from '../shared/identity';
import { api } from './api';
import { BuilderAutosave } from './builder-autosave';
import { Action, Empty, Poster } from './components';
import { FilmPicker } from './FilmPicker';
import { TurnFields } from './TurnFields';
export function BuilderScreen({catalog,viewer,rotation,onMovie,onPublished,readJournalMutation = operation=>operation(),onInspect,confirmedMovie,onConfirmedConsumed,onEditorChanged,newSetRequest = 0}: {onEditorChanged?: (editing: boolean) => void; newSetRequest?: number;onInspect?: (candidate: FilmCandidate, preview?: TmdbPreview, pending?: Promise<TmdbPreview>) => void; confirmedMovie?: Movie | null; onConfirmedConsumed?: () => void; catalog: Catalog; viewer: Viewer | null; rotation: Rotation | null; onMovie: (m: Movie) => void; onPublished: (result: JournalMutationResult) => void;readJournalMutation?:JournalMutationReader}) {
  const [sets,setSets] = useState<BuilderSet[]>([]), [editing,setEditing] = useState<BuilderSet | null>(null), [creating,setCreating] = useState(false);
  const [title,setTitle] = useState(''), [films,setFilms] = useState<Movie[]>([]);
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [loading,setLoading] = useState(true);
  const queue = useRef<BuilderAutosave | null>(null);
  const queues = useRef(new Map<string,BuilderAutosave>());
  const editorActive = useRef(false);
  const draftKeys = useRef(new WeakMap<BuilderAutosave,string>());
  const autosave = () => {
    const draft = queue.current;
    if (!draft) return;
    const id = draft.saved?.id ?? draftKeys.current.get(draft)!;
    const now = new Date().toISOString();
    setSets(current => [...current.filter(set => set.id !== id),{id,owner_member_id:viewer!.id,created_at:now,updated_at:now,revision:0,...draft.saved,...draft.current}]);
    setError(''); void draft.enqueue().catch(() => {});
  };
  const changeFilms = (next: Movie[]) => { setFilms(next); if (queue.current) queue.current.current = {...queue.current.current,movie_ids:next.map(m => m.id)}; autosave(); };
  const consumedMovie = useRef<Movie | null>(null);
  const acceptConfirmedMovie = useEffectEvent((movie: Movie) => {
    const next = [...(queue.current?.current.movie_ids ?? []).map(id => catalogIndex(catalog).movieById.get(id)!).filter(Boolean),movie];
    changeFilms(next); onConfirmedConsumed?.();
  });
  useEffect(() => {
    if (!confirmedMovie) { consumedMovie.current = null; return; }
    if (consumedMovie.current !== confirmedMovie) {
      consumedMovie.current = confirmedMovie;
      acceptConfirmedMovie(confirmedMovie);
    }
  },[confirmedMovie,onConfirmedConsumed]);
  const [deleting,setDeleting] = useState(false);
  const [publishing,setPublishing] = useState(false), [date,setDate] = useState(localToday()), [complete,setComplete] = useState(Boolean(rotation)), [cycle,setCycle] = useState(rotation?.cycle_id ?? ''), [slot,setSlot] = useState<number | null>(rotation?.nominal_slot ?? 1);
  const load = async () => { try { const loaded = await api.builders(); setSets(current => [...loaded.filter(set => !current.some(local => local.id === set.id)),...current]); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load Builder.'); } finally { setLoading(false); } };
  const viewerId = viewer?.id;
  useEffect(() => { if (viewerId) void load(); },[viewerId]);
  const open = (set?: BuilderSet) => {
    let draft = set ? queues.current.get(set.id) : undefined;
    if (!draft) {
      draft = new BuilderAutosave(set ?? null,api.saveBuilder,saved => {
        queues.current.set(saved.id,draft!);
        const latest = draft!.current;
        setSets(current => [...current.filter(item => item.id !== saved.id && item.id !== draftKeys.current.get(draft!)),{...saved,...latest}]);
        if (queue.current === draft && editorActive.current) { setEditing(saved); setCreating(false); }
      },failure => { setError(`Set changes are unsaved. ${failure instanceof Error ? failure.message : 'Could not save.'} Edit again or use Save set to retry.`); });
    }
    if (!draftKeys.current.has(draft)) { const key = set?.id ?? `draft-${crypto.randomUUID()}`; draftKeys.current.set(draft,key); queues.current.set(key,draft); }
    queue.current = draft; editorActive.current = true;
    setEditing(draft.saved); setCreating(!draft.saved); setTitle(draft.current.title);
    setFilms(draft.current.movie_ids.map(id => catalogIndex(catalog).movieById.get(id)!).filter(Boolean));
    setPublishing(false); setDeleting(false); setError('');
  };
  const lastNewSetRequest = useRef(newSetRequest);
  const openRequestedSet = useEffectEvent(() => open());
  useEffect(() => { if (newSetRequest && newSetRequest !== lastNewSetRequest.current) { lastNewSetRequest.current = newSetRequest; openRequestedSet(); } },[newSetRequest]);
  useEffect(() => { onEditorChanged?.(Boolean(creating || editing)); },[creating,editing,onEditorChanged]);
  useEffect(() => () => onEditorChanged?.(false),[onEditorChanged]);
  if (!viewer) return <Empty title="Builder is personal">Anonymous local bypass has no signed-in owner. Use a member session to plan privately.</Empty>;
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); } };
  const save = async () => queue.current!.flush();
  const currentMember = rotation ? effectiveMember(catalog.members,rotation) : undefined;
  const isCurrentTurn = currentMember?.id === viewer.id;
  const hostless = complete ? rotation?.nominal_slot === 5 : slot === 5;
  const inEditor = creating || editing;
  const orderedSets = [...sets].sort((a,b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  return <div className="stack builder-workflow"><p className="meta">Only you can access these private sets. Administrators cannot inspect them.</p>{!inEditor ? <>{loading && <p role="status">Loading your sets…</p>}<div className="history-grid">{orderedSets.map(set => <article className="card stack" key={set.id}><h2>{set.title || 'Untitled set'}</h2><div className="builder-poster-strip">{set.movie_ids.slice(0,4).map((id,i) => { const movie = catalogIndex(catalog).movieById.get(id); return movie ? <div className="builder-poster-film" key={`${id}-${i}`}><Poster movie={movie} /><span className="builder-poster-title" title={movie.title}>{movie.title}</span></div> : null; })}</div><Action icon={Film} onClick={() => open(set)}>Open set</Action></article>)}</div>{!loading && !sets.length && <Empty title="Your next night starts here">Keep several ideas, then use one when it is ready.</Empty>}</> : publishing && editing ? <section className="card stack" aria-labelledby="publish-heading"><h2 id="publish-heading">Use {editing.title || 'this set'}?</h2><p className="meta">{films.length === 1 ? '1 film in the saved order. This will move this film into a Book Club event as the one you brought.' : `${formatCount(films.length)} films in the saved order. This will move these films into a Book Club event as the ones you brought.`}</p><label className="input-label">Actual event date<input autoFocus type="date" className="field__input" required value={date} onChange={e => setDate(e.target.value)} /></label><TurnFields catalog={catalog} rotation={rotation} complete={complete} onComplete={setComplete} cycle={cycle} onCycle={setCycle} slot={slot} onSlot={setSlot} />
      <p className="meta">Actual host: {hostless ? 'CLSC · hostless' : viewer.display_name.toUpperCase()}</p>{complete && slot === 5 && <p className="notice">This completes Classics, marks all four members Seen for the lineup and returns to Sean's turn awaiting a new cycle.</p>}
      <div className="button-set"><Action icon={Check} intent="constructive" disabled={busy || !isCurrentTurn || !date || !slot} onClick={() => void run(async () => { const saved = await save(); const result = await readJournalMutation(()=>api.publishBuilder(saved.id,{revision: saved.revision,event_date: date,cycle_id: cycle === 'new' ? null : cycle || null,cycle_slot: slot!,complete_turn: complete,...(complete ? {turn_version: rotation?.version} : {}),...(cycle === 'new' ? {new_cycle: {rough_date: date}} : {})})); onPublished(result); })}>{busy ? 'Using set…' : 'Use set'}</Action><Action icon={ArrowLeft} disabled={busy} onClick={() => setPublishing(false)}>Back to set</Action></div></section> : <><div className="button-set builder-editor-actions"><Action icon={ArrowLeft} disabled={busy} onClick={() => { editorActive.current = false; setEditing(null); setCreating(false); }}>All sets</Action><Action icon={CalendarCheck} disabled={busy || !isCurrentTurn || !films.length} onClick={() => void run(async () => { await save(); setDate(localToday()); setComplete(Boolean(rotation)); setCycle(rotation?.cycle_id ?? ''); setSlot(rotation?.nominal_slot ?? 1); setPublishing(true); })}>Use set</Action><Action icon={Save} variant="primary" disabled={busy} onClick={() => void run(async () => { await save(); editorActive.current = false; setEditing(null); setCreating(false); })}>Save set</Action></div><section className="card stack"><label className="input-label">Private title (optional)<input className="field__input" maxLength={300} value={title} disabled={busy} onChange={e => { setTitle(e.target.value); if (queue.current) queue.current.current.title = e.target.value; }} onBlur={() => { if (queue.current && queue.current.current.title !== (queue.current.saved?.title ?? '')) autosave(); }} /></label></section><FilmPicker builder showManualAdd={false} movieById={catalogIndex(catalog).movieById} historyMovieIds={catalogIndex(catalog).historyMovieIds} onInspect={onInspect} allowDirectSelection selected={films} onSelected={changeFilms} onMovie={onMovie} disabled={busy} /><div className="builder-delete stack">{deleting && editing && <section className="inline-confirm stack" aria-label="Delete private set"><p>Permanently delete “{editing.title || 'Untitled set'}”? Its private title, note and {formatCount(editing.movie_ids.length)} saved film selections will be removed. Shared films and History remain.</p><div className="button-set"><Action icon={Trash2} intent="destructive" disabled={busy} onClick={() => void run(async () => { const saved = await save(); await api.deleteBuilder(saved.id,saved.revision); queues.current.delete(saved.id); setSets(current => current.filter(set => set.id !== saved.id)); setEditing(null); setCreating(false); setDeleting(false); await load(); })}>Permanently delete set</Action><Action icon={ArrowLeft} onClick={() => setDeleting(false)}>Keep set</Action></div></section>}{editing && <Action icon={Trash2} variant="danger" disabled={busy} onClick={() => { setDeleting(true); }}>Delete set</Action>}</div></>}{error && <p className="error-message" role="alert">{error}</p>}</div>;
}
