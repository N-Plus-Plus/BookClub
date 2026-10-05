import { useCallback, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { FilmCandidate, Movie, SearchResponse, TmdbPreview } from '../shared/types';
import { api } from './api';
import { candidatePage, searchCandidates } from '../shared/search';
import { Action, Empty, MovieRow, Poster } from './components';
export function FilmPicker({selected,onSelected,onMovie,disabled = false,onInspect}: {selected: Movie[]; onSelected: (films: Movie[]) => void; onMovie: (movie: Movie) => void; disabled?: boolean; onInspect?: (candidate: FilmCandidate, preview?: TmdbPreview, pending?: Promise<TmdbPreview>) => void}) {
  const [query,setQuery] = useState(''), [results,setResults] = useState<SearchResponse | null>(null);
  const [title,setTitle] = useState(''), [year,setYear] = useState(''), [runtime,setRuntime] = useState('');
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [searching,setSearching] = useState(false);
  const generation = useRef(0);
  const [page,setPage] = useState(1);
  const [previews,setPreviews] = useState<Record<string,TmdbPreview | null>>({});
  const cache = useRef(new Map<string,TmdbPreview | null>());
  const pending = useRef(new Map<string,Promise<TmdbPreview>>());
  const loadPreview = useCallback((id: string, signal?: AbortSignal): Promise<TmdbPreview> => {
    const stored = cache.current.get(id);
    if (stored) return Promise.resolve(stored);
    const inFlight = pending.current.get(id);
    if (inFlight) return inFlight;
    const request = api.preview(id,signal).then(preview => {
      cache.current.set(id,preview); setPreviews(current => ({...current,[id]:preview})); return preview;
    }).catch(error => {
      if (!signal?.aborted) { cache.current.set(id,null); setPreviews(current => ({...current,[id]:null})); }
      throw error;
    }).finally(() => { if (pending.current.get(id) === request) pending.current.delete(id); });
    pending.current.set(id,request);
    // Inspection may mount on the next hashchange; keep early failures handled.
    void request.catch(() => {});
    return request;
  },[]);
  const candidates = useMemo(() => results ? searchCandidates(results) : [],[results]);
  const visible = useMemo(() => candidatePage(candidates,page),[candidates,page]);
  const add = (movie: Movie) => onSelected([...selected,movie]);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { setBusy(false); } };
  const search = async (e: FormEvent) => {
    e.preventDefault(); setPage(1); const current = ++generation.current; setSearching(true); setError('');
    try { const data = await api.search(query.trim()); if (current === generation.current) setResults(data); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (current === generation.current) setSearching(false); }
  };
  const move = (index: number,offset: number) => { const next = [...selected]; [next[index],next[index+offset]] = [next[index+offset],next[index]]; onSelected(next); };
  return <div className="stack"><section className="card stack"><h2>Find a film</h2><form className="stack" onSubmit={search}><label className="input-label">Search saved films & TMDB<input className="field__input" value={query} maxLength={150} required onChange={e => setQuery(e.target.value)} /></label><Action type="submit" icon={Search} disabled={searching || disabled}>{searching ? 'Searching…' : 'Search'}</Action></form>
    {results && <div className="stack">{results.lookup.message && <p className="meta" role="status">{results.lookup.message}</p>}{visible.items.map(candidate => {
      const m = candidate.movie;
      const id = candidate.kind === 'local' ? candidate.movie.tmdbId : candidate.movie.externalId;
      const preview = id ? previews[id] : undefined;
      const poster = {title:m.title,assets:m.poster ? [{provider:'tmdb',asset_type:'poster' as const,reference:m.poster,width:null,height:null,preferred:1}] : []};
      const inspect = (e: MouseEvent<HTMLAnchorElement>) => {
        if (!onInspect || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); if (!disabled) onInspect(candidate,preview ?? undefined,
          candidate.kind === 'external' && !preview && id ? loadPreview(id) : id ? pending.current.get(id) : undefined);
      };
      return <div className="search-row" key={candidate.kind === 'local' ? `local-${candidate.movie.id}` : `tmdb-${candidate.movie.externalId}`}><a className="movie-link movie-row" href={candidate.kind === 'local' ? `#/movie/${candidate.movie.id}` : `#/preview/tmdb/${candidate.movie.externalId}`} onClick={inspect} aria-disabled={disabled}><Poster movie={poster} /><div className="movie-copy"><span className="movie-title">{m.title}</span><p className="meta">{m.year ?? 'Year unknown'} · Director: {preview?.director ?? 'Unknown'}</p></div></a>{!onInspect && <Action icon={Plus} aria-label={`Add ${m.title}`} disabled={busy || disabled} onClick={() => void run(async () => { const movie = candidate.kind === 'local' ? await api.detail(candidate.movie.id) : await api.importMovie(candidate.movie.externalId); onMovie(movie); add(movie); })} />}</div>;
    })}{candidates.length > 0 ? <div className="button-set search-pagination"><Action icon={ChevronLeft} disabled={visible.page === 1 || searching} onClick={() => setPage(value => value-1)}>Previous</Action><span className="meta" role="status">Page {visible.page} of {visible.pages}</span><Action icon={ChevronRight} disabled={visible.page === visible.pages || searching} onClick={() => setPage(value => value+1)}>Next</Action></div> : <Empty title="No matching films">Try another title or add it manually.</Empty>}</div>}
    <details><summary><Pencil size={18} aria-hidden="true" />Add a film manually</summary><form className="stack manual-form" onSubmit={e => { e.preventDefault(); void run(async () => { const movie = await api.createMovie({title,...(year ? {year: Number(year)} : {}),...(runtime ? {runtime: Number(runtime)} : {})}); onMovie(movie); add(movie); setTitle(''); setYear(''); setRuntime(''); }); }}><label className="input-label">Film title<input required className="field__input" maxLength={300} value={title} onChange={e => setTitle(e.target.value)} /></label><div className="two-fields"><label className="input-label">Year<input type="number" className="field__input" min={1870} max={2200} value={year} onChange={e => setYear(e.target.value)} /></label><label className="input-label">Runtime (min)<input type="number" className="field__input" min={1} max={10000} value={runtime} onChange={e => setRuntime(e.target.value)} /></label></div><Action type="submit" icon={Plus} disabled={busy || disabled}>Create & add film</Action></form></details>
  </section><section className="card stack"><h2>Lineup · {selected.length} films</h2><p className="meta">Viewing order matters. Add as many films as the night calls for.</p>{!selected.length && <Empty title="No films selected">Search or create a film above.</Empty>}<ol className="lineup-list">{selected.map((movie,i) => <li key={`${movie.id}-${i}`}><MovieRow movie={movie}><span className="meta">Viewing position {i+1}</span></MovieRow><div className="button-set"><Action icon={ArrowUp} aria-label={`Move ${movie.title} earlier`} disabled={i === 0 || disabled || busy} onClick={() => move(i,-1)} /><Action icon={ArrowDown} aria-label={`Move ${movie.title} later`} disabled={i === selected.length-1 || disabled || busy} onClick={() => move(i,1)} /><Action icon={Trash2} aria-label={`Remove ${movie.title}`} disabled={disabled || busy} onClick={() => onSelected(selected.filter((_,j) => i !== j))} /></div></li>)}</ol></section>{error && <p role="alert" className="error-message">{error}</p>}</div>;
}
