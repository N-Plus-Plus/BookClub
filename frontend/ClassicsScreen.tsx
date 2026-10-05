import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Library, ListSortDescending, Rows3 } from 'lucide-react';
import type { Catalog, Movie, MovieDetail, Viewer } from '../shared/types';
import { Action, Empty, RankingCard } from './components';
import { ClassicsMaintenance } from './ClassicsMaintenance';
export function ClassicsScreen({movies,writesEnabled,onMovie,viewer,catalog,onUpdated}: {catalog?: Catalog; onUpdated?: () => Promise<void>; viewer: Viewer | null; movies: Movie[]; writesEnabled: boolean; onMovie: (m: MovieDetail) => void}) {
  const [tab,setTab] = useState('Ranked'), [page,setPage] = useState(1);
  const groups = {Ranked: movies.filter(m => m.ranking?.eligible && m.ranking.rankable), 'Needs Data': movies.filter(m => m.ranking?.eligible && !m.ranking.rankable), 'Already Seen': movies.filter(m => !m.ranking?.eligible)};
  const visible = groups[tab as keyof typeof groups];
  const pageSize = tab === 'Ranked' ? 20 : 10;
  const pageCount = Math.max(1,Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page,pageCount);
  useEffect(() => { setPage(current => Math.min(current,pageCount)); },[pageCount]);
  const offset = (currentPage-1)*pageSize;
  const pagination = visible.length > 0 && <div className="button-set classics-pagination" role="group" aria-label="Classics pagination"><Action icon={ChevronLeft} disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</Action><span className="meta">Page {currentPage} of {pageCount}</span><Action icon={ChevronRight} disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>Next</Action></div>;
  return <div className="stack"><div className="button-set" aria-label="Classics states">{Object.entries(groups).map(([name,list]) => <Action key={name} icon={name === 'Ranked' ? ListSortDescending : name === 'Needs Data' ? Library : Rows3} aria-pressed={tab === name} onClick={() => { setTab(name); setPage(1); }}>{name} ({list.length})</Action>)}</div>
    <p className="meta">Watch Order uses six ratings. Missing ratings use the available-score average. Explicit No adds a modest novelty multiplier.</p>
    {pagination}<div className="ranking-list">{visible.slice(offset,offset+pageSize).map((m,i) => <div className="stack" key={m.id}><RankingCard variant="classics" movie={m} rank={tab === 'Ranked' ? offset+i+1 : undefined} compact /></div>)}</div>{pagination}
    {!visible.length && <Empty title={`No ${tab.toLowerCase()} films`}>Candidates appear here when they belong to Classics.</Empty>}{viewer?.role === 'admin' && <ClassicsMaintenance catalog={catalog ?? {movies,members:[],sessions:[],cycles:[]}} writesEnabled={writesEnabled} onMovie={onMovie} onUpdated={onUpdated} />}</div>;
}
