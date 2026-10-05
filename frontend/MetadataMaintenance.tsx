import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Square } from 'lucide-react';
import type { Catalog } from '../shared/types';
import { api } from './api';
import { Action } from './components';
import { maintainMetadata, type MetadataRun } from './metadata-maintenance';
import { metadataCandidate, tmdbIdentity } from '../shared/metadata';

export function MetadataMaintenance({catalog,onUpdated}: {catalog: Catalog; onUpdated: () => Promise<void>}) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [result,setResult] = useState<MetadataRun | null>(null);
  const stop = useRef(false), active = useRef(false);
  useEffect(() => () => { stop.current = true; },[]);
  const remaining = result?.remaining ?? catalog.movies.filter(metadataCandidate).length;
  const unidentified = result?.unidentified ?? catalog.movies.filter(m => !tmdbIdentity(m)).length;
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
  return <section className="card stack" aria-labelledby="tmdb-maintenance-heading"><h2 id="tmdb-maintenance-heading">TMDB metadata and artwork</h2>
      <p className="meta">Fetch missing artwork and unchecked or stale metadata from stored TMDB identities. Requests run in bounded batches. History and ratings are preserved.</p>
      <p className="meta">{remaining} identified films remaining · {unidentified} films without a valid TMDB identity.</p>
      <div className="button-set"><Action icon={RefreshCw} disabled={busy || !remaining} onClick={() => void maintain()}>Fill missing metadata</Action>
        {busy && <Action icon={Square} onClick={() => { stop.current = true; }}>Stop after this batch</Action>}</div>
      {busy && <p className="meta" role="status">Filling metadata… completed batches are saved.</p>}
      {result && <div role="status" className="stack"><p className="meta">{result.processed} processed this run · {result.updated} successfully updated · {result.results.filter(r => r.status !== 'success').length} failures.</p>
        {result.message && <p className="meta">{result.message}</p>}
        {result.results.filter(r => r.status !== 'success').map(r => <p key={r.movieId} className="error-message">{r.title}: {r.message}{r.retryAfter !== undefined ? ` Retry after at least ${r.retryAfter} seconds.` : ''}</p>)}</div>}
      {error && <p className="error-message" role="alert">{error}</p>}
  </section>;
}
