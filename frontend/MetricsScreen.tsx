import { useState } from 'react';
import { Eye, Filter, RefreshCw } from 'lucide-react';
import type { Catalog, MetadataEnrichment, Viewer } from '../shared/types';
import { calculateMetrics, type Appearance, type MetricsFilter } from '../shared/metrics';
import { api } from './api';
import { Action, dateLabel, Empty } from './components';
import { ClubIdentity } from './ClubIdentity';

const score = (value: number | null) => value === null ? 'No scores yet' : `${value.toFixed(2)} / 10`;
export function MetricsScreen({catalog,viewer,onUpdated}: {catalog: Catalog; viewer: Viewer | null; onUpdated: () => Promise<void>}) {
  const [filter,setFilter] = useState<MetricsFilter>({kind: 'all'});
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [result,setResult] = useState<MetadataEnrichment | null>(null);
  const metrics = calculateMetrics(catalog,filter);
  const maintain = async () => {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await api.enrichMetadata()); await onUpdated(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Metadata enrichment failed.'); }
    finally { setBusy(false); }
  };
  const list = (title: string,rows: Appearance[]) => <section className="card stack"><h2>{title}</h2>{!rows.length ? <p className="meta">No appearances with IMDb scores yet.</p> : <ol className="metrics-list">{rows.map(row => {
    const host = catalog.members.find(m => m.id === row.session.host_member_id);
    const cycle = catalog.cycles.find(c => c.id === row.session.cycle_id);
    return <li key={`${row.session.id}:${row.position}`}><div className="stack"><a className="metrics-film-link" href={`#/movie/${row.movie.id}`}><Eye size={16} aria-hidden="true" />{row.movie.title}{row.movie.year ? ` (${row.movie.year})` : ''}</a><p className="meta">{row.session.date_precision === 'exact' ? dateLabel(row.session.event_date) : `${dateLabel(row.session.event_date)} · ${row.session.date_precision === 'cycle_rough' ? 'cycle reference; actual date unknown' : 'actual date unknown'}`}{cycle ? ` · ${cycle.title || `Cycle ${cycle.ordinal}`}` : ''}{row.session.cycle_slot ? ` · Slot ${row.session.cycle_slot}` : ''} · Film {row.position}{row.session.title ? ` · ${row.session.title}` : ''}</p></div><strong>{row.imdb!.toFixed(1)}</strong>{row.session.kind === 'classics' ? <ClubIdentity identity={{kind: 'classics'}} /> : host ? <ClubIdentity identity={{kind: 'member',member: host}} /> : <span className="meta">Host unknown</span>}</li>;
  })}</ol>}</section>;
  return <div className="stack"><p className="eyebrow">ALL TIME</p><div className="metrics-filters" role="group" aria-label="Metrics identity filter"><button type="button" aria-pressed={filter.kind === 'all'} onClick={() => setFilter({kind: 'all'})}><Filter size={16} aria-hidden="true" />ALL</button>{catalog.members.filter(m => m.sort_order >= 1 && m.sort_order <= 4).sort((a,b) => a.sort_order-b.sort_order).map(member => <button type="button" key={member.id} aria-pressed={filter.kind === 'member' && filter.memberId === member.id} onClick={() => setFilter({kind: 'member',memberId: member.id})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'member',member}} /></button>)}<button type="button" aria-pressed={filter.kind === 'classics'} onClick={() => setFilter({kind: 'classics'})}><Filter size={12} className="metrics-filter-icon" aria-hidden="true" /><ClubIdentity identity={{kind: 'classics'}} /></button></div><p className="meta">Member filters follow the actual host, including swaps. Every film appearance counts, including repeat screenings. Builder stays private.</p>
    <div className="metrics-summary">{[['Events',metrics.events],['Film appearances',metrics.appearances],['Unique films',metrics.uniqueFilms],['Average IMDb',score(metrics.imdbAverage)]].map(([label,value]) => <div className="card stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <p className="meta">{metrics.imdbScored} / {metrics.appearances} appearances have IMDb scores. {metrics.genreCovered} / {metrics.appearances} have recognised stored genres; {metrics.uncategorised} are Uncategorised.</p>
    {!metrics.events && <Empty title="No events for this identity">Metrics will appear when qualifying events are recorded in History.</Empty>}
    <div className="metrics-rankings">{list('Top 5 by IMDb',metrics.top)}{list('Bottom 5 by IMDb',metrics.bottom)}</div>
    <section className="card stack"><h2>By Genre</h2><p className="meta">An appearance counts once in each of its genres, so totals may exceed film appearances. Percentages use all selected appearances. Averages use only scored appearances.</p>{metrics.genres.length ? <table className="metrics-table"><thead><tr><th scope="col">Genre</th><th scope="col" aria-label="Appearance count">Count</th><th scope="col">Share</th><th scope="col">IMDb</th></tr></thead><tbody>{metrics.genres.map(g => <tr key={g.genre}><th scope="row">{g.genre}</th><td>{g.appearances}</td><td>{g.percentage.toFixed(1)}%</td><td>{g.imdbAverage === null ? 'No scores' : g.imdbAverage.toFixed(2)}<small>{g.imdbScored} / {g.appearances} scored</small></td></tr>)}</tbody></table> : <p className="meta">No film appearances yet.</p>}</section>
    {viewer?.role === 'admin' && <section className="card stack"><h2>Metadata maintenance</h2><p className="meta">Explicitly fetch stored TMDB identities for up to 10 films with metadata gaps, prioritising genres. No History or ratings change. Some films may still have gaps after TMDB refresh.</p><Action icon={RefreshCw} disabled={busy} onClick={() => void maintain()}>{busy ? 'Filling metadata…' : 'Fill missing metadata'}</Action>{result && <div role="status" className="stack"><p className="meta">{result.results.filter(r => r.status === 'success').length} updated. {result.remaining} identified films still have metadata gaps. {result.unidentified} canonical films lack a TMDB identity.</p>{result.results.filter(r => r.status !== 'success').map(r => <p key={r.movieId} className="meta">{r.title}: {r.message}</p>)}</div>}{error && <p className="error-message" role="alert">{error}</p>}</section>}
  </div>;
}
