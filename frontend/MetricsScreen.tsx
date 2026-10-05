import { useEffect, useRef, useState } from 'react';
import { Filter, RefreshCw, Square } from 'lucide-react';
import type { Catalog, Viewer } from '../shared/types';
import { calculateMetrics, type Appearance, type MetricsFilter } from '../shared/metrics';
import { api } from './api';
import { Action, dateLabel, Empty, MovieLink } from './components';
import { maintainMetadata, type MetadataRun } from './metadata-maintenance';
import { metadataCandidate, tmdbIdentity } from '../shared/metadata';
import { ClubIdentity } from './ClubIdentity';

const score = (value: number | null) => value === null ? 'No scores yet' : `${value.toFixed(2)} / 10`;
export function MetricsScreen({catalog,viewer,onUpdated}: {catalog: Catalog; viewer: Viewer | null; onUpdated: () => Promise<void>}) {
  const [filter,setFilter] = useState<MetricsFilter>({kind: 'all'});
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [result,setResult] = useState<MetadataRun | null>(null);
  const stop = useRef(false), active = useRef(false);
  useEffect(() => () => { stop.current = true; },[]);
  const remaining = result?.remaining ?? catalog.movies.filter(metadataCandidate).length;
  const unidentified = result?.unidentified ?? catalog.movies.filter(m => !tmdbIdentity(m)).length;
  const contributions = [...catalog.members.map(m => ({label:m.display_name.toUpperCase(),value:calculateMetrics(catalog,{kind:'member',memberId:m.id})})),{label:'CLSC',value:calculateMetrics(catalog,{kind:'classics'})}];
  const metrics = calculateMetrics(catalog,filter);
  const maintain = async () => {
    if (active.current) return;
    active.current = true; stop.current = false;
    setBusy(true); setError(''); setResult(null);
    try {
      await maintainMetadata({batch: () => api.enrichMetadata(),stopped: () => stop.current,
        initial: {remaining,unidentified},progress: async run => {
          setResult(run);
        }});
    } catch (e) { setError(e instanceof Error ? e.message : 'Metadata enrichment failed. Completed updates are saved; resume later.'); }
    finally {
      try { await onUpdated(); }
      catch (e) { setError(`${e instanceof Error ? e.message : 'Could not refresh BookClub.'} Completed updates are saved; refresh or resume later.`); }
      finally { active.current = false; setBusy(false); }
    }
  };
  const list = (title: string,rows: Appearance[]) => <section className="card stack"><h2>{title}</h2>{!rows.length ? <p className="meta">No appearances with IMDb scores yet.</p> : <ol className="metrics-list">{rows.map(row => {
    const host = catalog.members.find(m => m.id === row.session.host_member_id);
    const cycle = catalog.cycles.find(c => c.id === row.session.cycle_id);
    return <li key={`${row.session.id}:${row.position}`}><MovieLink movie={row.movie} className="metrics-film-item"><div className="stack"><span className="movie-title">{row.movie.title}</span>{row.movie.year ? <span className="meta">({row.movie.year})</span> : null}<p className="meta">{row.session.date_precision === 'exact' ? dateLabel(row.session.event_date) : `${dateLabel(row.session.event_date)} · ${row.session.date_precision === 'cycle_rough' ? 'cycle reference; actual date unknown' : 'actual date unknown'}`}{cycle ? ` · ${cycle.title || `Cycle ${cycle.ordinal}`}` : ''}{row.session.cycle_slot ? ` · Slot ${row.session.cycle_slot}` : ''} · Film {row.position}{row.session.title ? ` · ${row.session.title}` : ''}</p></div><strong>{row.imdb!.toFixed(1)}</strong>{row.session.kind === 'classics' ? <ClubIdentity identity={{kind: 'classics'}} /> : host ? <ClubIdentity identity={{kind: 'member',member: host}} /> : <span className="meta">Host unknown</span>}</MovieLink></li>;
  })}</ol>}</section>;
  return <div className="stack metrics-content"><div className="metrics-filters" role="group" aria-label="Metrics identity filter"><button type="button" aria-pressed={filter.kind === 'all'} onClick={() => setFilter({kind: 'all'})}><Filter size={16} aria-hidden="true" />ALL</button>{catalog.members.filter(m => m.sort_order >= 1 && m.sort_order <= 4).sort((a,b) => a.sort_order-b.sort_order).map(member => <button type="button" key={member.id} aria-pressed={filter.kind === 'member' && filter.memberId === member.id} onClick={() => setFilter({kind: 'member',memberId: member.id})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'member',member}} /></button>)}<button type="button" aria-pressed={filter.kind === 'classics'} onClick={() => setFilter({kind: 'classics'})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'classics'}} /></button></div><p className="meta">All time · actual hosts · repeat screenings count.</p>
    <div className="metrics-summary">{[['Events',metrics.events],['Film appearances',metrics.appearances],['Unique films',metrics.uniqueFilms],['Average IMDb',score(metrics.imdbAverage)]].map(([label,value]) => <div className="card stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <p className="meta">{metrics.imdbScored} / {metrics.appearances} appearances have IMDb scores. {metrics.genreCovered} / {metrics.appearances} have recognised stored genres; {metrics.uncategorised} are Uncategorised.</p>
    {!metrics.events && <Empty title="No events for this identity">Metrics will appear when qualifying events are recorded in History.</Empty>}
    <section className="stack"><h2>Contribution by host</h2><p className="meta">All-time comparison, independent of the selected identity above.</p>{['events','appearances'].map(key => <figure className="comparison-chart" key={key}><figcaption>{key === 'events' ? 'Events' : 'Film appearances'}</figcaption>{contributions.map(row => { const value = row.value[key as 'events' | 'appearances']; const max = Math.max(1,...contributions.map(r => r.value[key as 'events' | 'appearances'])); return <div className="chart-row" key={row.label}><span>{row.label}</span><span className="chart-track" aria-hidden="true"><span style={{width:`${value/max*100}%`}} /></span><strong>{value}</strong></div>; })}</figure>)}</section><div className="metrics-rankings">{list('Top 5 by IMDb',metrics.top)}{list('Bottom 5 by IMDb',metrics.bottom)}</div>
    <section className="card stack"><h2>By Genre</h2><p className="meta">An appearance counts once in each of its genres, so totals may exceed film appearances. Percentages use all selected appearances. Averages use only scored appearances.</p>{metrics.genres.length ? <table className="metrics-table"><thead><tr><th scope="col">Genre</th><th scope="col" aria-label="Appearance count">Count</th><th scope="col">Share</th><th scope="col">IMDb</th></tr></thead><tbody>{metrics.genres.map(g => <tr key={g.genre}><th scope="row">{g.genre}</th><td>{g.appearances}</td><td>{g.percentage.toFixed(1)}%</td><td>{g.imdbAverage === null ? 'No scores' : g.imdbAverage.toFixed(2)}<small>{g.imdbScored} / {g.appearances} scored</small></td></tr>)}</tbody></table> : <p className="meta">No film appearances yet.</p>}</section>
    {viewer?.role === 'admin' && <details className="utility-disclosure"><summary>Admin · metadata maintenance</summary><div className="stack">
      <p className="meta">Fetch missing artwork and unchecked or stale metadata from stored TMDB identities. Each batch checks up to 10 films. History and ratings are preserved.</p>
      <p className="meta">{remaining} identified films remaining · {unidentified} films without a valid TMDB identity.</p>
      <div className="button-set"><Action icon={RefreshCw} disabled={busy || !remaining} onClick={() => void maintain()}>Fill missing metadata</Action>
        {busy && <Action icon={Square} onClick={() => { stop.current = true; }}>Stop after this batch</Action>}</div>
      {busy && <p className="meta" role="status">Filling metadata… completed batches are saved.</p>}
      {result && <div role="status" className="stack"><p className="meta">{result.processed} processed this run · {result.updated} successfully updated · {result.results.filter(r => r.status !== 'success').length} failures.</p>
        {result.message && <p className="meta">{result.message}</p>}
        {result.results.filter(r => r.status !== 'success').map(r => <p key={r.movieId} className="error-message">{r.title}: {r.message}{r.retryAfter !== undefined ? ` Retry after at least ${r.retryAfter} seconds.` : ''}</p>)}</div>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </div></details>}
  </div>;
}
