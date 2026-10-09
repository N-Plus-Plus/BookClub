import type { ReactNode, CSSProperties } from 'react';
import type { Catalog } from '../../../shared/types';
import type { Appearance, MetricsFilter } from '../../../shared/metrics';
import { formatCount } from '../../../shared/format';
import { ClubIdentity } from '../../ClubIdentity';
import { MovieLink } from '../../components';
export const number=(n:number|null|undefined,digits=1)=>n==null?'Unavailable':n.toLocaleString('en-AU',{maximumFractionDigits:digits,minimumFractionDigits:digits});
export const money=(n:number)=>`$${n.toLocaleString('en-AU',{maximumFractionDigits:0})} USD`;
export const grossMillions=(n:number)=>n>0&&Math.round(n/1_000_000)===0?'<$1M USD':`$${Math.round(n/1_000_000).toLocaleString('en-AU')}M USD`;
export function Report({title,note,children}:{title:string;note:string;children:ReactNode}) {
  return <section className="stack metrics-section staging-report" aria-label={title}><h2>{title}</h2><p className="meta">{note}</p>{children}</section>;
}
export const Empty=()=> <p className="meta">No qualifying evidence for this selection.</p>;
export function Contributor({catalog,filter}:{catalog:Catalog;filter:MetricsFilter}) {
  const member=filter.kind==='member'?catalog.members.find(m=>m.id===filter.memberId):null;
  return member?<ClubIdentity identity={{kind:'member',member}}/>:<ClubIdentity identity={{kind:'classics'}}/>;
}
export function FilmList({films}:{films:Appearance[]}) {
  return <span className="staging-film-links">{films.map((row,i)=><span key={row.movie.id}>{i>0?' · ':''}<MovieLink movie={row.movie}>{row.movie.title}</MovieLink></span>)}</span>;
}
export function FilmContributors({catalog,films,all}:{catalog:Catalog;films:Appearance[];all:Appearance[]}) {
  const ids=new Set(films.map(r=>r.movie.id)),filters=new Map<string,MetricsFilter>();
  for(const row of all)if(ids.has(row.movie.id)){const filter:MetricsFilter=row.session.kind==='classics'?{kind:'classics'}:{kind:'member',memberId:row.session.host_member_id!};filters.set(filter.kind==='member'?filter.memberId:'classics',filter);}
  return <span className="staging-identities">{[...filters.values()].sort((a,b)=>a.kind==='classics'?1:b.kind==='classics'?-1:(catalog.members.find(m=>m.id===(a.kind==='member'?a.memberId:''))?.sort_order??0)-(catalog.members.find(m=>m.id===(b.kind==='member'?b.memberId:''))?.sort_order??0)).map(f=><Contributor key={f.kind==='member'?f.memberId:f.kind} catalog={catalog} filter={f}/>)}</span>;
}
export function PairedBars({critic,audience,criticCount,audienceCount}:{critic:number|null;audience:number|null;criticCount:number;audienceCount:number}) {
  const values=[{name:'Critics',value:critic,count:criticCount,colour:'rose'},{name:'Audience',value:audience,count:audienceCount,colour:'indigo'}];
  const label=(v:typeof values[number])=><span className="meta">{v.name}: {v.value===null?'Unavailable':`${number(v.value)} / 100`}</span>;
  return <div className="staging-paired">{label(values[0])}{values.map(v=><div key={v.name} className="staging-score-track" role="img" aria-label={`${v.name}: ${v.value===null?'unavailable':`${number(v.value)} out of 100`}; ${formatCount(v.count)} scored appearances`}><span style={{width:`${v.value??0}%`,background:`var(--${v.colour})`}} /></div>)}{label(values[1])}</div>;
}
export function Interval({low,high,mean,minimum,maximum,label,colour}:{low:number|null;high:number|null;mean:number|null;minimum:number;maximum:number;label:string;colour:string}) {
  const position=(n:number)=>Math.max(0,Math.min(100,(n-minimum)/(maximum-minimum)*100));
  return <div className="staging-interval" role="img" aria-label={label}>{low!==null&&high!==null&&mean!==null?<><span className="staging-interval-band" style={{left:`${position(low)}%`,width:`${position(high)-position(low)}%`,background:`var(--${colour})`}}/><span className="staging-interval-mean" style={{left:`${position(mean)}%`}}/></>:<span className="meta">Unavailable</span>}</div>;
}
export function Matrix({catalog,scopes,filter,label,cell}:{catalog:Catalog;scopes:{label:string;filter:MetricsFilter}[];filter:MetricsFilter;label:string;cell:(a:number,b:number)=>{text:string;detail:string;colour?:string}}) {
  const matches=(f:MetricsFilter)=>filter.kind!=='all'&&f.kind===filter.kind&&(filter.kind!=='member'||f.kind==='member'&&f.memberId===filter.memberId);
  return <div className="staging-matrix-scroll" tabIndex={0} role="region" aria-label={`${label}, scroll horizontally for all contributors`}><table className="staging-matrix"><caption className="visually-hidden">{label}</caption><thead><tr><th scope="col">Contributor</th>{scopes.map((s,i)=><th scope="col" key={i} data-emphasis={matches(s.filter)}><Contributor catalog={catalog} filter={s.filter}/></th>)}</tr></thead><tbody>{scopes.map((s,a)=><tr key={a}><th scope="row" data-emphasis={matches(s.filter)}><Contributor catalog={catalog} filter={s.filter}/></th>{scopes.map((t,b)=>{const value=cell(a,b);return <td key={b} data-emphasis={matches(s.filter)||matches(t.filter)} data-diagonal={a===b} data-coloured={Boolean(value.colour)} title={value.detail} aria-label={`${s.label} and ${t.label}: ${value.detail}`} style={{'--pair-colour':value.colour?`var(--${value.colour})`:undefined} as CSSProperties}>{value.text}</td>;})}</tr>)}</tbody></table></div>;
}
