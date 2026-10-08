import { formatCount } from '../shared/format';
import { PaginationControls } from './PaginationControls';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Catalog, Movie, MovieDetail, Viewer } from '../shared/types';
import { RemoveClassicModal } from './RemoveClassicModal';
import { Action, Empty, RankingCard } from './components';
export const isUnrankedClassic = (movie:Movie) => Boolean(movie.ranking?.eligible && !movie.ranking.rankable);
export function ClassicsScreen({catalog,movies,viewer,writesEnabled,onMovie}: {catalog?: Catalog; onUpdated?: () => Promise<void>; viewer: Viewer | null; movies: Movie[]; writesEnabled: boolean; onMovie: (m: MovieDetail) => void}) {
  const [removing,setRemoving] = useState<Movie | null>(null);
  const [tab,setTab] = useState('Ranked'), [page,setPage] = useState(1);
  const groups = {Ranked: movies.filter(m => m.ranking?.eligible && m.ranking.rankable), 'Unranked': movies.filter(isUnrankedClassic), Seen: movies.filter(m => !m.ranking?.eligible)};
  const visible = groups[tab as keyof typeof groups];
  const pageSize = tab === 'Ranked' ? 20 : 10;
  const pageCount = Math.max(1,Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page,pageCount);
  useEffect(() => { setPage(current => Math.min(current,pageCount)); },[pageCount]);
  const offset = (currentPage-1)*pageSize;
  const pagination = visible.length > 0 && <div className="button-set classics-pagination pagination-controls" role="group" aria-label="Classics pagination"><PaginationControls page={currentPage} pages={pageCount} onPage={setPage} /></div>;
  return <div className="stack">{removing && <RemoveClassicModal movie={removing} onMovie={onMovie} onClose={() => setRemoving(null)} />}<div className="classics-filters" role="group" aria-label="Classics states">{Object.entries(groups).map(([name,list]) => <Action className="tab-control" key={name} aria-label={`${name}: ${formatCount(list.length)} films`} title={`${name}: ${formatCount(list.length)} films`} aria-pressed={tab === name} onClick={() => { setTab(name); setPage(1); }}><span>{name}</span>{name === 'Unranked' && list.length > 0 && <span aria-hidden="true" className="count-indicator classics-count classics-count-needs-data">{list.length > 99 ? '99+' : formatCount(list.length)}</span>}</Action>)}</div>
    {pagination}<div className="ranking-list">{visible.slice(offset,offset+pageSize).map((m,i) => <div className="stack" key={m.id}><RankingCard variant="classics" members={catalog?.members} movie={m} rank={tab === 'Ranked' ? offset+i+1 : undefined} compact action={viewer?.role === 'admin' && writesEnabled ? <Action icon={Trash2} className="classic-remove" variant="danger" aria-label={`Remove ${m.title} from Classics`} title={`Remove ${m.title} from Classics`} onClick={() => setRemoving(m)} /> : undefined} /></div>)}</div>{pagination}
    {!visible.length && <Empty title={`No ${tab.toLowerCase()} films`}>Candidates appear here when they belong to Classics.</Empty>}</div>;
}
