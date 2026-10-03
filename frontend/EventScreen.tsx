import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Save, Search, Trash2, User } from 'lucide-react';
import type { Catalog, Movie, SearchResponse, Session } from '../shared/types';
import { api } from './api';
import { Action, Empty, MovieRow } from './components';

function today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
export function EventScreen({catalog,writesEnabled,onMovie,onSaved}: {catalog: Catalog; writesEnabled: boolean; onMovie: (m: Movie) => void; onSaved: (s: Session) => void}) {
  const [date,setDate] = useState(today), [title,setTitle] = useState(''), [host,setHost] = useState('');
  const [selected,setSelected] = useState<Movie[]>([]);
  const [query,setQuery] = useState(''), [results,setResults] = useState<SearchResponse | null>(null);
  const [manualTitle,setManualTitle] = useState(''), [year,setYear] = useState(''), [runtime,setRuntime] = useState('');
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [searching,setSearching] = useState(false);
  const [savedMessage,setSavedMessage] = useState('');
  const searchGeneration = useRef(0);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); } };
  const add = (movie: Movie) => { setSelected(s => [...s,movie]); setSavedMessage(`${movie.title} added to the event.`); };
  const search = async (event: FormEvent) => {
    event.preventDefault(); if (!query.trim()) return;
    const generation = ++searchGeneration.current; setSearching(true); setError('');
    try { const response = await api.search(query.trim()); if (generation === searchGeneration.current) setResults(response); }
    catch (e) { if (generation === searchGeneration.current) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (generation === searchGeneration.current) setSearching(false); }
  };
  const move = (index: number,offset: number) => setSelected(current => {
    const next = [...current]; [next[index],next[index+offset]] = [next[index+offset],next[index]]; return next;
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!selected.length) { setError('Add at least one film before saving the event.'); return; }
    void run(async () => { const session = await api.saveSession({event_date: date,title,host_member_id: host || null,movie_ids: selected.map(m => m.id)}); onSaved(session); });
  };
  return <div className="event-grid"><div className="stack"><section className="card stack"><p className="eyebrow">01 · THE NIGHT</p><h2>Event details</h2>
    <form id="event-details" className="stack" onSubmit={save}><label className="input-label">Date<input className="field__input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="input-label">Title or theme <span className="meta">Optional</span><input className="field__input" maxLength={300} value={title} placeholder="A night of firsts" onChange={e => setTitle(e.target.value)} /></label>
      <fieldset><legend>Host <span className="meta">Optional</span></legend><div className="host-options">{[{id: '',display_name: 'Not known'},...catalog.members.filter(m => m.active)].map(m => <label className="host-option" key={m.id}><input type="radio" name="host" checked={host === m.id} onChange={() => setHost(m.id)} /><User size={16} aria-hidden="true" />{m.display_name}</label>)}</div></fieldset>
    </form></section>
    <section className="card stack"><p className="eyebrow">02 · THE FILMS</p><h2>Find a film</h2><form className="stack" onSubmit={search}><label className="input-label">Search saved films & TMDB<input className="field__input" value={query} maxLength={150} required placeholder="Film title or year" onChange={e => setQuery(e.target.value)} /></label><Action type="submit" icon={Search} disabled={searching}>{searching ? 'Searching…' : 'Search'}</Action></form>
      {results && <div className="stack"><p className="meta" role="status">{results.lookup.message ?? 'TMDB results available. Selecting one saves its metadata locally.'}</p>{results.local.map(m => <div className="search-row" key={m.id}><MovieRow movie={m} /><Action icon={Plus} aria-label={`Add ${m.title}`} disabled={busy || !writesEnabled} onClick={() => add(m)} /></div>)}
      {results.external.map(m => <div className="search-row" key={m.externalId}><div className="movie-copy"><strong>{m.title}</strong><p className="meta">{m.year ?? 'Year unknown'} · TMDB</p></div><Action icon={Plus} aria-label={`Import and add ${m.title}`} disabled={busy || !writesEnabled} onClick={() => void run(async () => { const movie = await api.importMovie(m.externalId); onMovie(movie); add(movie); })} /></div>)}
      {!results.local.length && !results.external.length && <Empty title="No matching films">Try another title or add the film manually below.</Empty>}</div>}
      <details><summary><Pencil size={18} aria-hidden="true" />Add a film manually</summary><form className="stack manual-form" onSubmit={event => {
        event.preventDefault(); void run(async () => { const movie = await api.createMovie({title: manualTitle,...(year ? {year: Number(year)} : {}),...(runtime ? {runtime: Number(runtime)} : {})}); onMovie(movie); add(movie); setManualTitle(''); setYear(''); setRuntime(''); });
      }}><label className="input-label">Film title<input className="field__input" required maxLength={300} value={manualTitle} onChange={e => setManualTitle(e.target.value)} /></label><div className="two-fields"><label className="input-label">Year<input className="field__input" type="number" min={1870} max={2200} value={year} onChange={e => setYear(e.target.value)} /></label><label className="input-label">Runtime (min)<input className="field__input" type="number" min={1} max={10000} value={runtime} onChange={e => setRuntime(e.target.value)} /></label></div><Action type="submit" icon={Plus} intent="constructive" disabled={busy || !writesEnabled}>Create & add film</Action></form></details>
    </section></div><section className="card stack event-lineup"><p className="eyebrow">03 · THE LINEUP</p><h2>{selected.length ? `${selected.length} film${selected.length === 1 ? '' : 's'} for tonight` : 'Build your lineup'}</h2><p className="meta">Films are saved in viewing order. Add as many as the night calls for.</p>
      {!selected.length && <Empty title="No films selected">Search the local collection or create a film manually.</Empty>}
      <ol className="lineup-list">{selected.map((m,i) => <li key={`${m.id}-${i}`}><MovieRow movie={m}><span className="meta">Viewing position {i+1}</span></MovieRow><div className="button-set"><Action icon={ArrowUp} aria-label={`Move ${m.title} earlier`} disabled={i === 0 || busy} onClick={() => move(i,-1)} /><Action icon={ArrowDown} aria-label={`Move ${m.title} later`} disabled={i === selected.length-1 || busy} onClick={() => move(i,1)} /><Action icon={Trash2} aria-label={`Remove ${m.title}`} disabled={busy} onClick={() => setSelected(s => s.filter((_,j) => j!==i))} /></div></li>)}</ol>
      {savedMessage && <p className="inline-status" role="status"><Check size={18} aria-hidden="true" />{savedMessage}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <Action form="event-details" type="submit" icon={Save} intent="constructive" disabled={busy || !writesEnabled}>{busy ? 'Saving…' : 'Save event'}</Action></section>
  </div>;
}
