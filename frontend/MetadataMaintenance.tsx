import { formatCount } from '../shared/format';
import { estimateMaintenance } from './maintenance-estimates';
import { MaintenanceOperationDetails } from './MaintenanceOperationDetails';
import { useState } from 'react';
import { RefreshCw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { api } from './api';
import { Action } from './components';
import { maintainMetadata, type MetadataRun } from './metadata-maintenance';
import { metadataCandidate, metadataQueue, tmdbIdentity } from '../shared/metadata';
import { useBulkJobController, MaintenanceProgress } from './bulk-maintenance';

export function MetadataMaintenance({catalog,onUpdated,writesEnabled=true}: {catalog: Catalog; onUpdated: () => Promise<void>;writesEnabled?:boolean}) {
  const job=useBulkJobController();
  const {busy,error,setError,stop}=job;
  const [result,setResult] = useState<MetadataRun | null>(null);
  const remaining = busy && result ? result.remaining : catalog.movies.filter(metadataCandidate).length;
  const unidentified = busy && result ? result.unidentified : catalog.movies.filter(m => !tmdbIdentity(m)).length;
  const maintain = () => job.execute(async () => { setError(''); setResult(null);
    try {
      await maintainMetadata({ids: metadataQueue(catalog.movies),unidentified:catalog.movies.filter(m => !tmdbIdentity(m)).length,
        batch: ids => api.enrichMetadataSelected(ids),stopped: () => stop.current,progress: async run => {
          setResult(run);
        }});
    } catch (e) { setError(e instanceof Error ? e.message : 'Metadata enrichment failed. Completed updates are saved; resume later.'); }
    finally {
      try { await onUpdated(); }
      catch (e) { setError(`${e instanceof Error ? e.message : 'Could not refresh BookClub.'} Completed updates are saved; refresh or resume later.`); }

    }
  });
  return <section className="card stack" aria-labelledby="tmdb-maintenance-heading"><h2 id="tmdb-maintenance-heading">Fill missing TMDB metadata and artwork</h2>
      <MaintenanceOperationDetails operation="tmdb-metadata" estimate={estimateMaintenance('tmdb-metadata',catalog.movies.filter(metadataCandidate))} />
      <p className="meta">{formatCount(remaining)} identified films remaining · {formatCount(unidentified)} films without a valid TMDB identity.</p>
      <div className="button-set action-group-wrap"><Action icon={RefreshCw} disabled={busy || job.locked || !writesEnabled || !remaining} onClick={() => void maintain()}>Fill missing TMDB metadata</Action>
        {busy && <Action icon={Square} onClick={job.requestStop}>Stop after this batch</Action>}</div>
      {busy && <p className="meta" role="status">Filling metadata… completed batches are saved.</p>}
      {result && <MaintenanceProgress state={result.interrupted || error ? 'interrupted' : 'normal'} processed={result.processed} total={result.total} label="TMDB maintenance progress" summary={<>{formatCount(result.processed)} / {formatCount(result.total)} processed this run · {formatCount(result.updated)} successfully updated · {formatCount(result.failed)} failures.</>} beforeProgress={result.message && <p className="meta">{result.message}</p>}>

        {result.failure && <p className="error-message">{result.failure}</p>}</MaintenanceProgress>}
      {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
