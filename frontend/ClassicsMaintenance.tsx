import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Square } from 'lucide-react';
import type { Catalog, MovieDetail } from '../shared/types';
import { maintenanceIdentity, maintenanceMovies, missingScores, type MaintenanceMode } from '../shared/score-maintenance';
import { api } from './api';
import { Action } from './components';
import { ProviderFeedback } from './maintenance-feedback';
import { maintainScores, type MaintenanceRun } from './score-maintenance';
const labels = {missing:'Populate Missing Scores',refresh:'Refresh Scores',metadata:'Enrich/Refresh Metadata'};
export function ClassicsMaintenance({catalog,writesEnabled,onMovie,onUpdated}: {
  catalog: Catalog; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated?: () => Promise<void>;
}) {
  const [mode,setMode] = useState<MaintenanceMode | null>(null), [run,setRun] = useState<MaintenanceRun | null>(null), [error,setError] = useState('');
  const active = useRef(false), stop = useRef(false);
  useEffect(() => () => { stop.current = true; },[]);
  const movies = maintenanceMovies(catalog);
  const start = async (operation: MaintenanceMode) => {
    if (active.current) return;
    const candidates = movies.filter(m => operation !== 'missing' || missingScores(m));
    const ids = candidates.filter(m => maintenanceIdentity(m,operation)).map(m => m.id);
    active.current = true; stop.current = false; setMode(operation); setError('');
    setRun({results:[],processed:0,total:ids.length,remaining:ids.length,message:''});
    let applied = 0;
    try {
      await maintainScores({ids,batch:selected => api.maintainMovies(operation,selected),stopped:() => stop.current,
        progress:async result => { result.results.slice(applied).forEach(r => onMovie(r.movie)); applied = result.results.length; setRun(result); }});
    } finally {
      try { await onUpdated?.(); }
      catch (e) { setError(`${e instanceof Error ? e.message : 'Could not refresh BookClub.'} Completed updates are saved.`); }
      active.current = false; setMode(null);
    }
  };
  return <section className="card stack classics-maintenance" aria-labelledby="score-maintenance-heading"><h2 id="score-maintenance-heading">Scores and OMDb metadata</h2>
    <p className="meta">Covers all {movies.length} distinct films in Classics and History. Scores use IMDb, RT audience, RT critic, Letterboxd, Metacritic and TMDB. Refreshing scores can change Ranked order.</p>
    <p className="meta">Populate fills missing score inputs. Refresh checks every identified film. Requests run sequentially in bounded batches, with no automatic retries and a stop on provider failures or cooldowns.</p>
    <p className="meta">Metadata separately refreshes release year, runtime, director and IMDb genres through OMDb. Available metadata is also saved when a score fallback already uses OMDb, without another call. Unavailable values preserve stored metadata.</p>
    <p className="meta">{movies.filter(m => !maintenanceIdentity(m,'refresh')).length} films need a score identity · {movies.filter(m => !maintenanceIdentity(m,'metadata')).length} films need an IMDb identity for metadata.</p>
    <div className="button-set">{(Object.keys(labels) as MaintenanceMode[]).map(operation => <Action key={operation} icon={RefreshCw} disabled={Boolean(mode) || !writesEnabled || !movies.some(m => maintenanceIdentity(m,operation) && (operation !== 'missing' || missingScores(m)))} onClick={() => void start(operation)}>{labels[operation]}</Action>)}
    {mode && <Action icon={Square} onClick={() => { stop.current = true; }}>Stop after this batch</Action>}</div>
    {run && <div className="stack" role="status"><p className="meta">{mode ? `${labels[mode]}… ` : ''}{run.processed} / {run.total} films processed · {run.remaining} remaining · {run.results.filter(r => r.providers.some(p => p.status === 'success' && p.count > 0)).length} updated.</p>
      <progress max={Math.max(1,run.total)} value={run.processed} aria-label="Bulk maintenance progress" />
      {run.message && <p className="meta">{run.message}</p>}
      {run.results.filter(r => r.providers.some(p => p.status === 'failed' || p.retryAfter !== undefined || p.status === 'success' && p.count === 0) || !r.providers.some(p => p.status === 'success')).map(r => <div key={r.movie.id}><strong>{r.movie.title}</strong><ProviderFeedback providers={r.providers.filter(p => p.status !== 'success' || p.count === 0)} /></div>)}
    </div>}{error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
