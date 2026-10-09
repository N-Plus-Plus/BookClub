import { discoveries } from '../../shared/metrics-staging/films';
import type { Appearance } from '../../shared/metrics';
import { formatCount } from '../../shared/format';
import { FilmInformation, MovieLink, Poster } from '../components';
import { MetricsResults } from '../MetricsResults';
import { Report, Empty, number } from './staging/primitives';
import { useMemo } from 'react';

export function DiscoveryRankings({rows}:{rows:Appearance[]}) {
  const ranks=useMemo(()=>discoveries(rows),[rows]);
  return <>{(['hidden','cult'] as const).map(kind=>{
    const items:{row:Appearance;audience:number;votes:number;critic:number | null;index:string}[]=kind==='hidden'?ranks.hidden.map(v=>({...v,index:`${number(v.rank)} index`})) : ranks.cult.map(v=>({...v,index:`+${number(v.gap)} points`}));
    const title=kind==='hidden'?'Top 5 hidden gems':'Top 5 most cult';
    return <Report key={kind} title={title} note={kind==='hidden'?'High audience scores with fewer pooled votes; at least 100 votes.':'The largest audience lead over critics; at least 100 pooled votes and a 10-point gap.'}>
      {items.length?<ol className="staging-discoveries"><MetricsResults label={title} list items={items} render={(v,i)=><li key={v.row.movie.id}>
        <span className="staging-discovery-rank">#{formatCount(i+1)}</span><MovieLink movie={v.row.movie}><Poster movie={v.row.movie}/></MovieLink>
        <div className="staging-discovery-text"><MovieLink movie={v.row.movie}><FilmInformation movie={v.row.movie} beforeMetadata={<p className="meta">Audience {number(v.audience)} / 100{kind==='cult'&&<> · Critics {number(v.critic)} / 100</>} · {formatCount(v.votes)} pooled votes</p>}/></MovieLink></div>
        <strong className="staging-discovery-index">{v.index}</strong>
      </li>}/></ol>:<Empty/>}
    </Report>;
  })}</>;
}
