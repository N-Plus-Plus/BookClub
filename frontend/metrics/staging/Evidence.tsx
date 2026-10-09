import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { oscarSummary } from '../../../shared/provider-evidence';
import type { Catalog } from '../../../shared/types';
import type { Appearance, MetricsFilter } from '../../../shared/metrics';
import type { MetricsEnrichment } from '../../../shared/metrics-enrichment';
import { sharedStars, partnerships, genreRevenue, expensiveFlops, classificationAcclaim, platforms, collectionCompletion, localCalendarDate, awardsReport } from '../../../shared/metrics-staging/films';
import { useStagingReports } from './cache';
import { MetricsResults } from '../../MetricsResults';
import { MovieLink, Poster } from '../../components';
import { formatCount } from '../../../shared/format';
import { Report, Empty, Contributor, PairedBars, number, money, grossMillions } from './primitives';

export function SharedStarsReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"people");
  const stars=cached('stars',()=>sharedStars(catalog,all,data));
  return <Report title="Shared stars" note="Actors shared across the boobs.">{stars.length?<div className="staging-table-scroll" tabIndex={0} role="region" aria-label="Shared stars table"><table className="staging-stars-table"><caption className="visually-hidden">Actor appearances across Sean, Troy, Matt and Jess, and their total</caption><thead><tr><th scope="col">Actor</th>{catalog.members.filter(m=>m.sort_order>=1&&m.sort_order<=4).sort((a,b)=>a.sort_order-b.sort_order).map(m=><th scope="col" key={m.id}>{m.display_name}</th>)}<th scope="col">Total</th></tr></thead><tbody><MetricsResults label="Shared stars" tableColumns={6} items={stars} render={v=><tr key={v.id}><th scope="row">{v.label}</th>{v.counts.map((n,i)=><td key={i}>{formatCount(n)}</td>)}<td>{formatCount(v.appearances)}</td></tr>}/></tbody></table></div>:<Empty/>}</Report>;
}
export function PartnershipsReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"people");
  const pairs=cached('pairs',()=>partnerships(rows,data));
  return <Report title="Creative partnerships" note="Most frequent director collaborations, with fifth-place ties.">{pairs.map(group=><section className="stack" key={group.role}><h3>Director + {group.role}</h3>{group.values.length?<MetricsResults label={`Director + ${group.role}`} items={group.values} render={v=><article className="staging-data-row" key={v.id}><strong>{v.director} + {v.partner}</strong><p className="staging-supporting">{formatCount(v.films.length)} distinct films</p><ul className="metrics-metadata-films">{v.films.map(row=><li key={row.movie.id}><MovieLink movie={row.movie}>{row.movie.title}</MovieLink></li>)}</ul></article>}/>:<Empty/>}</section>)}</Report>;
}
export interface EvidenceProps {catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;reportCache?:Map<string,unknown>}
export function GenreRevenueReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"reception");
  const revenue=cached('revenue',()=>genreRevenue(rows,data));
  return <Report title="Highest-grossing film by genre" note="The biggest reported worldwide gross in each genre.">{revenue.length?<table className="staging-revenue-table"><thead><tr><th scope="col">Genre</th><th scope="col">Film / reported gross</th></tr></thead><tbody>{revenue.map(v=><tr key={v.genre}><th scope="row">{v.genre}</th><td>{v.films.map(row=><div className="staging-gross-film" key={row.movie.id}><MovieLink movie={row.movie}><span className="movie-title">{row.movie.title}</span></MovieLink><p className="meta">{grossMillions(v.revenue)}</p></div>)}</td></tr>)}</tbody></table>:<Empty/>}</Report>;
}
export function FlopsReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"reception");
  const flops=cached('flops',()=>expensiveFlops(catalog,all,filter,data));
  return <Report title="Most expensive flops" note="The largest reported budget per reception point for each contributor.">{flops.map(group=><div className="staging-flop-group" key={group.label}>{group.values.length?group.values.map(v=><article className="staging-data-row staging-flop" key={v.row.movie.id}><Contributor catalog={catalog} filter={group.filter}/><div className="staging-flop-content"><MovieLink movie={v.row.movie}><span className="movie-title">{v.row.movie.title}</span></MovieLink><p className="meta">Budget: {money(v.budget)}</p><p className="meta">Score: {number(v.score)} / 100</p><p className="meta">Dollars per point: {money(v.ratio)}</p></div></article>):<div className="staging-data-row staging-flop"><Contributor catalog={catalog} filter={group.filter}/><Empty/></div>}</div>)}</Report>;
}
export function ClassificationAcclaimReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"reception");
  const classification=cached('classification',()=>classificationAcclaim(rows,data));
  return <Report title="Classification versus acclaim" note="Average critic and audience scores by Australian classification.">{classification.map(v=><article className="staging-data-row staging-classification" key={v.id}><h3>{v.label}</h3><PairedBars {...v}/></article>)}</Report>;
}
export function PlatformsReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"reception");
  const offers=cached('offers',()=>platforms(rows));
  return <Report title="Streaming platform representation" note="Top streaming services across selected films, from cached Australian availability.">{offers.values.length?<MetricsResults label="Streaming platforms" items={offers.values} render={v=><article className="staging-data-row" key={v.id}><strong>{v.name}</strong><p className="staging-supporting">Stream {formatCount(v.count)} distinct films · {number(v.percentage)}%</p><p className="meta">Rent {formatCount(v.access.find(a=>a.type==='rent')?.count ?? 0)} · Buy {formatCount(v.access.find(a=>a.type==='buy')?.count ?? 0)}</p></article>}/>:<Empty/>}<p className="meta">Australian watch availability: <a href="https://www.justwatch.com/au" target="_blank" rel="noreferrer">JustWatch</a> via <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>; cached options may change.</p></Report>;
}
export function CollectionReports({catalog,all,rows,data,reportCache}:EvidenceProps) {
 const today=useCollectionDate();
 const cached=useStagingReports([catalog,all,rows,data],reportCache,'discovery');
 const collections=cached(`collections:${today}`,()=>collectionCompletion(all,data,today));
 return <>{(['completed','unrequited'] as const).map(status=><Report key={status} title={status==='completed'?'Franchise / collection completed':'Unrequited collections'} note={status==='completed'?'Every eligible TMDB collection film brought, excluding known future releases.':'Collections with eligible films still to bring, excluding known future releases.'}>
    {collections[status].length?<MetricsResults label={status==='completed'?'Completed collections':'Unrequited collections'} items={collections[status]} render={v=><article className="staging-data-row" key={v.id}><h3>{v.name}</h3><p className="meta">{formatCount(v.films.length)} of {formatCount(v.total)} films</p><ul className="metrics-metadata-films">{v.films.map(row=><li key={row.movie.id}><MovieLink movie={row.movie}>{row.movie.title}</MovieLink></li>)}</ul>{v.missing.some(part=>part.title)&&<div className="staging-missing-films meta"><span>Not brought:</span>{v.missing.filter(part=>part.title).map(part=><span key={part.id}>{part.title}</span>)}</div>}</article>}/>:<Empty/>}
    {collections.pending>0&&<p className="meta">{formatCount(collections.pending)} eligible {collections.pending===1?'collection awaits':'collections await'} a validated membership check in Admin.</p>}
  </Report>)}</>;
}
export function AwardsReport({catalog,all,rows,filter,data,reportCache}:EvidenceProps) {
  const cached=useStagingReports([catalog,all,rows,filter,data],reportCache,"discovery");
  const awards=cached('awards',()=>awardsReport(rows,data));
  return <Report title="Awards and nominations" note="Reported wins and nominations, with explicitly confirmed Oscars results.">{awards.values.length?<AwardsWindow values={awards.values}/>:<Empty/>}</Report>;
}
function AwardsWindow({values}:{values:ReturnType<typeof awardsReport>['values']}) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    const fit=()=>{const header=node.querySelector('.staging-awards-header')!;const rows=[...node.querySelectorAll('.staging-awards-row')].slice(0,5);const height=header.getBoundingClientRect().height+rows.reduce((sum,row)=>sum+row.getBoundingClientRect().height,0);if(height>0)node.style.maxHeight=`${height}px`;};
    fit();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(fit);for(const child of node.querySelectorAll('.staging-awards-header,.staging-awards-row'))observer.observe(child);return ()=>observer.disconnect();
  },[values]);
  return <div ref={ref} className="staging-awards-table" tabIndex={0} role="region" aria-label="Awards results, first twenty films; scroll vertically for more"><div role="table" aria-label="Reliably quantified OMDb awards"><div className="staging-awards-header" role="row"><span role="columnheader">Film incl. Oscars</span><span role="columnheader">Won</span><span role="columnheader">Nom.</span></div>{values.slice(0,20).map(v=>{const oscars=oscarSummary(v.awards_text);return <article className="staging-awards-row" role="row" key={v.row.movie.id}><div role="cell" className="staging-awards-film"><Poster movie={v.row.movie}/><div><MovieLink movie={v.row.movie}>{v.row.movie.title}</MovieLink>{oscars&&<p className="meta">{oscars}</p>}<p className="meta">Critics {number(v.critic)}</p><p className="meta">Audiences {number(v.audience)}</p></div></div><div role="cell" aria-label={`Wins: ${v.wins===null?'unavailable':v.wins}`}><span className="staging-mobile-label">Won: </span>{v.wins===null?'Unavailable':formatCount(v.wins)}</div><div role="cell" aria-label={`Nominations: ${v.nominations===null?'unavailable':v.nominations}`}><span className="staging-mobile-label">Nom.: </span>{v.nominations===null?'Unavailable':formatCount(v.nominations)}</div></article>;})}</div></div>;
}

/** Recompute at the next local date boundary, and after a sleeping/backgrounded tab resumes. */
function useCollectionDate() {
  const [,refresh]=useReducer((value:number)=>value+1,0),today=localCalendarDate();
  useEffect(()=>{
    const now=new Date(),midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    const timer=setTimeout(refresh,midnight.getTime()-now.getTime());
    const resume=()=>refresh();
    window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    return ()=>{clearTimeout(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[today]);
  return today;
}
