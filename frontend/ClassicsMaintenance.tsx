import { formatCount } from '../shared/format';
import { estimateMaintenance } from './maintenance-estimates';
import { MaintenanceOperationDetails } from './MaintenanceOperationDetails';
import { useEffect, useState } from 'react';
import { RefreshCw, Square, RotateCcw } from 'lucide-react';
import type { Catalog, MovieDetail, ScoreMaintenanceStatus } from '../shared/types';
import { maintenanceIdentity, maintenanceMovies, type MaintenanceMode } from '../shared/score-maintenance';
import { api } from './api';
import { Action } from './components';
import { useBulkJobController, MaintenanceProgress } from './bulk-maintenance';
import { ProviderFeedback } from './maintenance-feedback';
import { maintainScores, type MaintenanceRun } from './score-maintenance';
import { freshOmdbCheckpoint, loadOmdbCheckpoint, maintainOmdbMetadata, reconcileOmdbCheckpoint, saveOmdbCheckpoint, type OmdbCheckpoint } from './omdb-maintenance';
const labels = {missing:'Populate missing scores',refresh:'Refresh scores',metadata:'Refresh OMDb metadata'};
const actions = {missing:'Populate missing scores',refresh:'Refresh scores',metadata:'Refresh OMDb metadata'};
export function ClassicsMaintenance({catalog,writesEnabled,onMovie,onUpdated}: {
  catalog: Catalog; writesEnabled: boolean; onMovie: (movie: MovieDetail) => void; onUpdated?: () => Promise<void>;
}) {
  const job=useBulkJobController();
  const {error,setError,stop}=job;
  const [mode,setMode] = useState<MaintenanceMode | null>(null), [run,setRun] = useState<MaintenanceRun | null>(null);
  const [checkpoint,setCheckpoint] = useState<OmdbCheckpoint | null>(() => loadOmdbCheckpoint());
  const [resumed,setResumed] = useState(false);
  const [runMode,setRunMode] = useState<MaintenanceMode | null>(null);
  const checkpointChanged = (value: OmdbCheckpoint | null) => { saveOmdbCheckpoint(value); setCheckpoint(value); };
  const [status,setStatus] = useState<ScoreMaintenanceStatus | null>(null);
  useEffect(() => { let mounted = true; api.scoreMaintenanceStatus().then(value => { if (mounted) setStatus(value); }).catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Could not load score check status.'); }); return () => { mounted = false; }; },[setError]);
  const movies = maintenanceMovies(catalog,status?.eligibleIds);
  const resumable = checkpoint ? reconcileOmdbCheckpoint(checkpoint,catalog) : null;
  const start = (operation: MaintenanceMode) => job.execute(async () => {
    const candidates = movies.filter(m => operation !== 'missing' || status?.candidateIds.includes(m.id));
    const saved = operation === 'metadata' ? (resumable ?? freshOmdbCheckpoint(catalog)) : null;
    if (saved) checkpointChanged(saved.remainingIds.length ? saved : null);
    const ids = candidates.filter(m => maintenanceIdentity(m,operation)).map(m => m.id);
    setMode(operation); setRunMode(operation); setResumed(Boolean(saved?.completed)); setError('');
    setRun({updated:0,noChange:0,failed:0,providers:[],processed:saved?.completed ?? 0,total:saved ? saved.completed+saved.remainingIds.length : ids.length,remaining:saved?.remainingIds.length ?? ids.length,message:''});

    try {
      const handlers = {batch:(selected: string[]) => api.maintainMovies(operation,selected),stopped:() => stop.current,
        progress:async (result: MaintenanceRun,batch?: import('../shared/types').RefreshResult[]) => { batch?.forEach(r => onMovie(r.movie)); setRun(result); }};
      if (saved) await maintainOmdbMetadata({...handlers,checkpoint:saved,checkpointChanged});
      else await maintainScores({...handlers,ids});
    } finally {
      try { await onUpdated?.(); setStatus(await api.scoreMaintenanceStatus()); }
      catch (e) { setError(`${e instanceof Error ? e.message : 'Could not refresh BookClub.'} Completed updates are saved.`); }
      setMode(null);
    }
  });
  return <>{(Object.keys(labels) as MaintenanceMode[]).map(operation => {
    const candidates=(operation==='metadata' ? catalog.movies : movies).filter(movie=>maintenanceIdentity(movie,operation) && (operation!=='missing' || status?.candidateIds.includes(movie.id)));
    const pending=operation==='metadata' && resumable?.remainingIds.length ? candidates.filter(movie=>resumable.remainingIds.includes(movie.id)) : candidates;
    return <section key={operation} className="card stack classics-maintenance" aria-labelledby={`${operation}-maintenance-heading`}><h2 id={`${operation}-maintenance-heading`}>{labels[operation]}</h2>
      <MaintenanceOperationDetails operation={operation} estimate={estimateMaintenance(operation,pending)} />
      <p className="meta">{formatCount(candidates.length)} eligible films{operation==='metadata' && resumable ? ` · ${formatCount(resumable.completed)} checkpoint films completed · ${formatCount(pending.length)} remaining` : ''} · {formatCount((operation==='metadata' ? catalog.movies : movies).length-candidates.length)} outside this operation's scope.</p>
      {operation==='missing' && !status && <p className="meta">Loading missing-score eligibility…</p>}
      {operation==='missing' && status && <p className="meta">{formatCount(status.eligibleDimensions)} score inputs eligible · {formatCount(status.unavailableDimensions)} confirmed unavailable ({formatCount(status.unavailableFilms)} films).</p>}
      <div className="button-set action-group-wrap"><Action icon={RefreshCw} disabled={Boolean(mode) || job.locked || !writesEnabled || !candidates.length} onClick={()=>void start(operation)}>{operation==='metadata' && resumable?.remainingIds.length ? `Resume OMDb metadata · ${formatCount(resumable.remainingIds.length)} remaining` : actions[operation]}</Action>
        {operation==='metadata' && checkpoint && !mode && <Action icon={RotateCcw} variant="tertiary" disabled={job.locked} onClick={()=>{checkpointChanged(null);setRun(null);}}>Discard metadata progress</Action>}
        {mode===operation && <Action icon={Square} onClick={job.requestStop}>Stop after this batch</Action>}</div>
      {run && runMode===operation && <MaintenanceProgress state={run.interrupted || error ? 'interrupted' : 'normal'} processed={run.processed} total={run.total} label={`${labels[operation]} progress`} className="score-maintenance-progress" summary={<>{mode ? `${labels[operation]}… ` : ''}{formatCount(run.processed)} / {formatCount(run.total)} films processed · {formatCount(run.remaining)} remaining · {formatCount(run.updated)} updated · {formatCount(run.noChange)} {operation==='metadata' ? 'with no change' : 'with no new scores'} · {formatCount(run.failed)} failures.</>}>
        {operation==='metadata' && resumed && <p className="meta">Update, no-change and failure counts are for this visit.</p>}{run.message && <p className="meta">{run.message}</p>}{run.providers.some(provider=>provider.status==='failed') && <ProviderFeedback providers={run.providers.filter(provider=>provider.status==='failed')} />}
      </MaintenanceProgress>}
      {error && (runMode===operation || !runMode && operation==='missing') && <p className="error-message" role="alert">{error}</p>}
    </section>;
  })}</>;
}
