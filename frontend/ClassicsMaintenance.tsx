import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Square, RotateCcw } from 'lucide-react';
import type { Catalog, MovieDetail, ScoreMaintenanceStatus } from '../shared/types';
import { maintenanceIdentity, maintenanceMovies, type MaintenanceMode } from '../shared/score-maintenance';
import { api } from './api';
import { Action } from './components';
import { useBulkMaintenanceLock } from './bulk-maintenance';
import { ProviderFeedback } from './maintenance-feedback';
import { maintainScores, type MaintenanceRun } from './score-maintenance';
import { freshOmdbCheckpoint, loadOmdbCheckpoint, maintainOmdbMetadata, reconcileOmdbCheckpoint, saveOmdbCheckpoint, type OmdbCheckpoint } from './omdb-maintenance';
const labels = {missing:'Populate Missing Scores',refresh:'Refresh Scores',metadata:'Enrich/Refresh Metadata'};
export function ClassicsMaintenance({catalog,writesEnabled,onMovie,onUpdated}: {
  catalog: Catalog; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated?: () => Promise<void>;
}) {
  const lock=useBulkMaintenanceLock();
  const [mode,setMode] = useState<MaintenanceMode | null>(null), [run,setRun] = useState<MaintenanceRun | null>(null), [error,setError] = useState('');
  const [checkpoint,setCheckpoint] = useState<OmdbCheckpoint | null>(() => loadOmdbCheckpoint());
  const [resumed,setResumed] = useState(false);
  const [runMode,setRunMode] = useState<MaintenanceMode | null>(null);
  const checkpointChanged = (value: OmdbCheckpoint | null) => { saveOmdbCheckpoint(value); setCheckpoint(value); };
  const [status,setStatus] = useState<ScoreMaintenanceStatus | null>(null);
  useEffect(() => { let mounted = true; api.scoreMaintenanceStatus().then(value => { if (mounted) setStatus(value); }).catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Could not load score check status.'); }); return () => { mounted = false; }; },[]);
  const active = useRef(false), stop = useRef(false);
  useEffect(() => () => { stop.current = true; },[]);
  const movies = maintenanceMovies(catalog);
  const resumable = checkpoint ? reconcileOmdbCheckpoint(checkpoint,catalog) : null;
  const start = async (operation: MaintenanceMode) => {
    if (active.current || !lock.acquire()) return;
    const candidates = movies.filter(m => operation !== 'missing' || status?.candidateIds.includes(m.id));
    const saved = operation === 'metadata' ? (resumable ?? freshOmdbCheckpoint(catalog)) : null;
    if (saved) checkpointChanged(saved.remainingIds.length ? saved : null);
    const ids = candidates.filter(m => maintenanceIdentity(m,operation)).map(m => m.id);
    active.current = true; stop.current = false; setMode(operation); setRunMode(operation); setResumed(Boolean(saved?.completed)); setError('');
    setRun({updated:0,noChange:0,failed:0,providers:[],processed:saved?.completed ?? 0,total:saved ? saved.completed+saved.remainingIds.length : ids.length,remaining:saved?.remainingIds.length ?? ids.length,message:''});

    try {
      const handlers = {batch:(selected: string[]) => api.maintainMovies(operation,selected),stopped:() => stop.current,
        progress:async (result: MaintenanceRun,batch?: import('../shared/types').RefreshResult[]) => { batch?.forEach(r => onMovie(r.movie)); setRun(result); }};
      if (saved) await maintainOmdbMetadata({...handlers,checkpoint:saved,checkpointChanged});
      else await maintainScores({...handlers,ids});
    } finally {
      try { await onUpdated?.(); setStatus(await api.scoreMaintenanceStatus()); }
      catch (e) { setError(`${e instanceof Error ? e.message : 'Could not refresh BookClub.'} Completed updates are saved.`); }
      active.current = false; setMode(null); lock.release();
    }
  };
  return <section className="card stack classics-maintenance" aria-labelledby="score-maintenance-heading"><h2 id="score-maintenance-heading">Scores and OMDb metadata</h2>
    <p className="meta">Scores: IMDb, RT-A, RT-C, LB, MC and TMDB. Populate fills missing scores; Refresh rechecks identified films. OMDb Metadata refreshes title, year, runtime, director and genres across the whole catalogue with a valid IMDb identity.</p>
    <p className="meta">{movies.filter(m => !maintenanceIdentity(m,'refresh')).length} need score identity · {catalog.movies.filter(m => !maintenanceIdentity(m,'metadata')).length} need IMDb identity for metadata · {catalog.movies.filter(m => maintenanceIdentity(m,'metadata')).length} eligible for whole-catalogue OMDb Metadata.</p>
    {status && <p className="meta">{status.eligibleDimensions} score inputs eligible · {status.unavailableDimensions} confirmed unavailable ({status.unavailableFilms} films).</p>}
    <div className="button-set">{(Object.keys(labels) as MaintenanceMode[]).map(operation => <Action key={operation} icon={RefreshCw} disabled={Boolean(mode) || lock.busy || !writesEnabled || !(operation === 'metadata' ? catalog.movies : movies).some(m => maintenanceIdentity(m,operation) && (operation !== 'missing' || status?.candidateIds.includes(m.id)))} onClick={() => void start(operation)}>{operation === 'metadata' && resumable?.remainingIds.length ? `Resume Metadata · ${resumable.remainingIds.length} remaining` : labels[operation]}</Action>)}
    {checkpoint && !mode && <Action icon={RotateCcw} variant="tertiary" onClick={() => { checkpointChanged(null); setRun(null); }}>Discard metadata progress</Action>}
    {mode && <Action icon={Square} onClick={() => { stop.current = true; }}>Stop after this batch</Action>}</div>
    {run && <div className="stack" role="status"><p className="meta">{mode ? `${labels[mode]}… ` : ''}{run.processed} / {run.total} films processed · {run.remaining} remaining · {run.updated} updated · {run.noChange} {runMode === 'metadata' ? 'with no change' : 'with no new scores'} · {run.failed} failures.</p>
      <progress className="score-maintenance-progress" max={Math.max(1,run.total)} value={run.processed} aria-label="Bulk maintenance progress" />
      {runMode === 'metadata' && resumed && <p className="meta">Update, no-change and failure counts are for this visit.</p>}
      {run.message && <p className="meta">{run.message}</p>}
      {run.providers.some(provider => provider.status === 'failed') && <ProviderFeedback providers={run.providers.filter(provider => provider.status === 'failed')} />}
    </div>}{error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
