import { useState } from 'react';
import { Library, RefreshCw } from 'lucide-react';
import type { Movie, MovieDetail } from '../shared/types';
import { Action, Empty, RankingCard, RouteLink } from './components';
import { api } from './api';
export function ClassicsScreen({movies,writesEnabled,onMovie}: {movies: Movie[]; writesEnabled: boolean; onMovie: (m: MovieDetail) => void}) {
  const [tab,setTab] = useState('Ranked'), [busy,setBusy] = useState(false), [status,setStatus] = useState(''), [error,setError] = useState('');
  const groups = {Ranked: movies.filter(m => m.ranking?.eligible && m.ranking.rankable), 'Needs Data': movies.filter(m => m.ranking?.eligible && !m.ranking.rankable), Disqualified: movies.filter(m => !m.ranking?.eligible)};
  const run = async (task: () => Promise<void>) => { setBusy(true); setStatus(''); setError(''); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Refresh failed.'); } finally { setBusy(false); } };
  const visible = groups[tab as keyof typeof groups];
  return <div className="stack"><div className="button-set" aria-label="Classics states">{Object.entries(groups).map(([name,list]) => <Action key={name} icon={Library} aria-pressed={tab === name} onClick={() => setTab(name)}>{name} ({list.length})</Action>)}</div>
    <p className="meta">Watch Order uses IMDb + RT audience + RT critic. Explicit No adds a modest novelty multiplier.</p>
    {tab === 'Needs Data' && <Action icon={RefreshCw} disabled={busy || !writesEnabled} onClick={() => void run(async () => {
      const result = await api.enrich(); result.results.forEach(r => onMovie(r.movie));
      const waits = result.results.flatMap(r => r.providers.filter(p => p.retryAfter !== undefined).map(p => `${p.provider}: wait ${p.retryAfter}s before retrying.`));
      setStatus(`Attempted ${result.results.length} films. ${result.results.reduce((n,r) => n+r.providers.filter(p => p.status === 'failed').length,0)} provider failures. ${result.remaining} identifiable films remain; ${result.unidentified} need identification. ${[...waits,...result.results.flatMap(r => r.providers.filter(p => p.status !== 'success').map(p => `${p.provider}: ${p.message}`))].filter((v,i,a) => a.indexOf(v) === i).join(' ')}`);
    })}>{busy ? 'Refreshing…' : 'Enrich up to 10 films'}</Action>}
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="error-message">{error}</p>}
    <div className="classics-grid">{visible.map((m,i) => <div className="stack" key={m.id}><RankingCard movie={m} rank={tab === 'Ranked' ? i+1 : undefined} />
      {tab === 'Needs Data' && (m.external_ids.some(e => ['imdb','tmdb'].includes(e.provider)) ? <Action icon={RefreshCw} disabled={busy || !writesEnabled} onClick={() => void run(async () => { const r = await api.refreshScores(m.id); onMovie(r.movie); setStatus(r.providers.map(p => `${p.provider}: ${p.message}${p.retryAfter !== undefined ? ` Wait ${p.retryAfter}s before retrying.` : ''}`).join(' ')); })}>Refresh scores</Action> : <RouteLink to={`movie/${m.id}`} icon={Library}>Inspect candidate</RouteLink>)}</div>)}</div>
    {!visible.length && <Empty title={`No ${tab.toLowerCase()} films`}>Candidates appear here when they belong to Classics.</Empty>}</div>;
}
