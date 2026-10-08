import { AustralianAvailability } from './AustralianAvailability';
import { PaginationControls } from './PaginationControls';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { FilmCandidate, Movie, MovieDetail, SearchResponse, TmdbPreview } from '../shared/types';
import { api } from './api';
import { candidatePage, searchCandidates } from '../shared/search';
import { Action, Empty, MovieRow, Poster } from './components';
export function FilmPicker({selected,onSelected,onMovie,disabled = false,onInspect,onCandidateSelected,onSelectionPending,allowDirectSelection = false,showManualAdd = true,builder = false,movies = [],movieById}: {showManualAdd?: boolean; builder?: boolean; movies?: Movie[]; movieById?: ReadonlyMap<string,Movie>; allowDirectSelection?: boolean; selected: Movie[]; onSelected: (films: Movie[]) => void; onMovie: (movie: Movie) => void; disabled?: boolean; onSelectionPending?: (pending: boolean) => void; onCandidateSelected?: (candidate: FilmCandidate, film: MovieDetail | TmdbPreview) => void; onInspect?: (candidate: FilmCandidate, preview?: TmdbPreview, pending?: Promise<TmdbPreview>) => void}) {
  const [query,setQuery] = useState(''), [results,setResults] = useState<SearchResponse | null>(null);
  const [title,setTitle] = useState(''), [year,setYear] = useState(''), [runtime,setRuntime] = useState('');
  const [error,setError] = useState(''), [busy,setBusy] = useState(false), [searching,setSearching] = useState(false);
  const [page,setPage] = useState(1);
  const workInFlight = useRef(false);
  const generation = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const focusAfterSelection = useRef(false);
  useEffect(() => { if (!busy && focusAfterSelection.current) { focusAfterSelection.current = false; searchInput.current?.focus(); } },[busy]);
  const resetSearch = useCallback(() => {
    focusAfterSelection.current = Boolean(searchInput.current?.disabled); generation.current++; setQuery(''); setResults(null); setPage(1); setSearching(false);
    searchInput.current?.focus();
  },[]);
  const previousSelected = useRef(selected);
  useEffect(() => {
    if (selected.length > previousSelected.current.length) resetSearch();
    previousSelected.current = selected;
  },[selected,resetSearch]);
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
  const add = (movie: Movie) => { onSelected([...selected,movie]); resetSearch(); };
  const run = async (work: () => Promise<void>) => { if (workInFlight.current) return; workInFlight.current = true; setBusy(true); onSelectionPending?.(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); } finally { workInFlight.current = false; setBusy(false); onSelectionPending?.(false); } };
  const search = async (e: FormEvent) => {
    e.preventDefault(); setPage(1); const current = ++generation.current; setSearching(true); setError('');
    try { const data = await api.search(query.trim()); if (current === generation.current) setResults(data); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (current === generation.current) setSearching(false); }
  };
  const move = (index: number,offset: number) => { const next = [...selected]; [next[index],next[index+offset]] = [next[index+offset],next[index]]; onSelected(next); };
  return <div className="stack"><section className="card stack"><h2>Find a film</h2><form className="stack" onSubmit={search}><label className="input-label">Search saved films & TMDB<input ref={searchInput} disabled={busy || disabled} className="field__input" value={query} maxLength={150} required onChange={e => { generation.current++; setSearching(false); setResults(null); setQuery(e.target.value); }} /></label><Action type="submit" icon={Search} disabled={searching || busy || disabled}>{searching ? 'Searching…' : 'Search'}</Action></form>
    {results && <div className="stack">{results.lookup.message && <p className="meta" role="status">{results.lookup.message}</p>}{visible.items.map(candidate => {
      const m = candidate.movie;
      const id = candidate.kind === 'local' ? candidate.movie.tmdbId : candidate.movie.externalId;
      const preview = id ? previews[id] : undefined;
      const director = candidate.kind === 'local' ? (movieById ? movieById.get(candidate.movie.id) : movies.find(movie => movie.id === candidate.movie.id))?.director ?? preview?.director : preview?.director;
      const poster = {title:m.title,assets:m.poster ? [{provider:'tmdb',asset_type:'poster' as const,reference:m.poster,width:null,height:null,preferred:1}] : []};
      const inspect = (e: MouseEvent<HTMLAnchorElement>) => {
        if (!onInspect || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); if (!disabled) onInspect(candidate,preview ?? undefined,
          candidate.kind === 'external' && !preview && id ? loadPreview(id) : id ? pending.current.get(id) : undefined);
      };
      return <div className="search-row" key={candidate.kind === 'local' ? `local-${candidate.movie.id}` : `tmdb-${candidate.movie.externalId}`}><a className="movie-link movie-row" href={candidate.kind === 'local' ? `#/movie/${candidate.movie.id}` : `#/preview/tmdb/${candidate.movie.externalId}`} onClick={inspect} aria-disabled={disabled}><Poster movie={poster} /><div className="movie-copy"><span className="movie-title">{m.title}</span><p className="meta">{m.year ?? 'Year unknown'}{director?.trim() && director.trim().toLowerCase() !== 'unknown' ? ` · Director: ${director}` : ''}</p>{builder && candidate.kind === 'local' && movieById?.get(candidate.movie.id) && <AustralianAvailability movie={movieById.get(candidate.movie.id)!} />}</div></a>{(!onInspect || allowDirectSelection) && <Action className={builder ? "button button--icon builder-result-add" : "button button--icon"} icon={Plus} aria-label={`${onCandidateSelected ? 'Select' : 'Add'} ${m.title}`} disabled={busy || disabled} onClick={() => void run(async () => { if (onCandidateSelected) { const film = candidate.kind === 'local' ? await api.detail(candidate.movie.id) : await loadPreview(candidate.movie.externalId); onCandidateSelected(candidate,film); resetSearch(); } else { const movie = candidate.kind === 'local' ? await api.detail(candidate.movie.id) : await api.importMovie(candidate.movie.externalId); onMovie(movie); add(movie); } })} />}</div>;
    })}{candidates.length > 0 ? <div className="button-set search-pagination"><PaginationControls page={visible.page} pages={visible.pages} onPage={setPage} disabled={searching} status /></div> : <Empty title="No matching films">Try another title or add it manually.</Empty>}</div>}
    {!onCandidateSelected && showManualAdd && <details><summary><Pencil size={18} aria-hidden="true" />Add a film manually</summary><form className="stack manual-form" onSubmit={e => { e.preventDefault(); void run(async () => { const movie = await api.createMovie({title,...(year ? {year: Number(year)} : {}),...(runtime ? {runtime: Number(runtime)} : {})}); onMovie(movie); add(movie); setTitle(''); setYear(''); setRuntime(''); }); }}><label className="input-label">Film title<input required className="field__input" maxLength={300} value={title} onChange={e => setTitle(e.target.value)} /></label><div className="two-fields"><label className="input-label">Year<input type="number" className="field__input" min={1870} max={2200} value={year} onChange={e => setYear(e.target.value)} /></label><label className="input-label">Runtime (min)<input type="number" className="field__input" min={1} max={10000} value={runtime} onChange={e => setRuntime(e.target.value)} /></label></div><Action type="submit" icon={Plus} disabled={busy || disabled}>Create & add film</Action></form></details>}
  </section>{!onCandidateSelected && <section className="card stack"><h2>Lineup · {selected.length} films</h2><p className="meta">Viewing order matters. Add as many films as the night calls for.</p>{!selected.length && <Empty title="No films selected">Search or create a film above.</Empty>}<ol className={`lineup-list${builder ? " builder-lineup" : ""}`}>{selected.map((movie,i) => <li key={`${movie.id}-${i}`}><div className={builder ? "builder-lineup-identity" : undefined}>{builder && <span className="position">#{i+1}</span>}<MovieRow movie={movie}><p className="meta">Director: {movie.director ?? 'Unknown'}</p>{builder && <AustralianAvailability movie={movieById?.get(movie.id) ?? movie} empty />}{!builder && <span className="meta">Viewing position {i+1}</span>}</MovieRow></div><div className="button-set"><Action icon={ArrowUp} aria-label={`Move ${movie.title} earlier`} disabled={i === 0 || disabled || busy} onClick={() => move(i,-1)} /><Action icon={ArrowDown} aria-label={`Move ${movie.title} later`} disabled={i === selected.length-1 || disabled || busy} onClick={() => move(i,1)} /><Action icon={Trash2} aria-label={`Remove ${movie.title}`} disabled={disabled || busy} onClick={() => onSelected(selected.filter((_,j) => i !== j))} /></div></li>)}</ol></section>}{error && <p role="alert" className="error-message">{error}</p>}</div>;
}
