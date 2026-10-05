import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Library, ListSortDescending, RefreshCw, Rows3 } from 'lucide-react';
import type { Movie, MovieDetail, RefreshResult, Viewer } from '../shared/types';
import { Action, Empty, RankingCard, RouteLink } from './components';
import { api } from './api';
import { BulkScoreFeedback, ProviderFeedback } from './maintenance-feedback';
export function ClassicsScreen({movies,writesEnabled,onMovie,viewer}: {viewer: Viewer | null; movies: Movie[]; writesEnabled: boolean; onMovie: (m: MovieDetail) => void}) {
  const [tab,setTab] = useState('Ranked'), [page,setPage] = useState(1), [busy,setBusy] = useState<string | null>(null);
  const [bulk,setBulk] = useState<{result?: Awaited<ReturnType<typeof api.enrich>>; error?: string}>({});
  const [candidates,setCandidates] = useState<Record<string,{result?: RefreshResult; error?: string}>>({});
  const groups = {Ranked: movies.filter(m => m.ranking?.eligible && m.ranking.rankable), 'Needs Data': movies.filter(m => m.ranking?.eligible && !m.ranking.rankable), 'Already Seen': movies.filter(m => !m.ranking?.eligible)};
  const enrich = async () => {
    if (busy) return;
    setBusy('bulk'); setBulk({});
    try { const result = await api.enrich(); result.results.forEach(item => onMovie(item.movie)); setBulk({result}); }
    catch (error) { setBulk({error: error instanceof Error ? error.message : 'Enrichment failed.'}); }
    finally { setBusy(null); }
  };
  const refresh = async (id: string) => {
    if (busy) return;
    setBusy(id); setCandidates(current => ({...current,[id]:{}}));
    try { const result = await api.refreshScores(id); onMovie(result.movie); setCandidates(current => ({...current,[id]:{result}})); }
    catch (error) { setCandidates(current => ({...current,[id]:{error: error instanceof Error ? error.message : 'Refresh failed.'}})); }
    finally { setBusy(null); }
  };
  const visible = groups[tab as keyof typeof groups];
  const pageSize = tab === 'Ranked' ? 20 : 10;
  const pageCount = Math.max(1,Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page,pageCount);
  useEffect(() => { setPage(current => Math.min(current,pageCount)); },[pageCount]);
  const offset = (currentPage-1)*pageSize;
  const pagination = visible.length > 0 && <div className="button-set classics-pagination" role="group" aria-label="Classics pagination"><Action icon={ChevronLeft} disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</Action><span className="meta">Page {currentPage} of {pageCount}</span><Action icon={ChevronRight} disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>Next</Action></div>;
  return <div className="stack"><div className="button-set" aria-label="Classics states">{Object.entries(groups).map(([name,list]) => <Action key={name} icon={name === 'Ranked' ? ListSortDescending : name === 'Needs Data' ? Library : Rows3} aria-pressed={tab === name} onClick={() => { setTab(name); setPage(1); }}>{name} ({list.length})</Action>)}</div>
    <p className="meta">Watch Order uses IMDb + RT audience + RT critic. Explicit No adds a modest novelty multiplier.</p>
    {viewer?.role === 'admin' && <details className="utility-disclosure"><summary>Admin · score maintenance</summary><div className="stack"><Action icon={RefreshCw} disabled={Boolean(busy) || !writesEnabled} onClick={() => void enrich()}>{busy === 'bulk' ? 'Refreshing…' : 'Enrich up to 10 films'}</Action>
    {bulk.result && <BulkScoreFeedback result={bulk.result} />}{bulk.error && <p role="alert" className="error-message">Bulk enrichment result could not be confirmed. {bulk.error} Some scores may have been saved. Check affected films before running enrichment again.</p>}
    </div></details>}{pagination}<div className="ranking-list">{visible.slice(offset,offset+pageSize).map((m,i) => <div className="stack" key={m.id}><RankingCard variant="classics" movie={m} rank={tab === 'Ranked' ? offset+i+1 : undefined} compact />
      {tab === 'Needs Data' && viewer?.role === 'admin' && (<details className="utility-disclosure"><summary>Admin · score maintenance</summary>{candidates[m.id]?.result && <div role="status"><strong>Score refresh result · {m.title}</strong><ProviderFeedback providers={candidates[m.id].result!.providers} /></div>}{candidates[m.id]?.error && <p role="alert" className="error-message">Score refresh result could not be confirmed for {m.title}. {candidates[m.id].error} Some scores may have been saved. Inspect this film before refreshing again.</p>}{m.external_ids.some(e => ['imdb','tmdb'].includes(e.provider)) ? <Action icon={RefreshCw} disabled={Boolean(busy) || !writesEnabled} onClick={() => void refresh(m.id)}>{busy === m.id ? 'Refreshing…' : 'Refresh scores'}</Action> : <RouteLink to={`movie/${m.id}`} icon={Library}>Inspect candidate</RouteLink>}</details>)}</div>)}</div>{pagination}
    {!visible.length && <Empty title={`No ${tab.toLowerCase()} films`}>Candidates appear here when they belong to Classics.</Empty>}</div>;
}
