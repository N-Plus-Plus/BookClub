import type { Catalog } from '../../../shared/types';
import type { Appearance, MetricsFilter } from '../../../shared/metrics';
import { formatCount } from '../../../shared/format';
import { cycleScorecards, contributorSpreads, contributorLeaning } from '../../../shared/metrics-staging/numerical';
import { useStagingReports } from './cache';
import { runtimeLabel } from '../../FilmIdentity';
import { Report, Empty, Contributor, PairedBars, Interval, number } from './primitives';
import { useLayoutEffect, useRef } from 'react';

function CycleWindow({cycles}:{cycles:ReturnType<typeof cycleScorecards>}) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    const fit=()=>{const height=[...node.children].slice(0,5).reduce((sum,child)=>sum+child.getBoundingClientRect().height,0);if(height>0)node.style.maxHeight=`${height}px`;};
    fit();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(fit);for(const child of node.children)observer.observe(child);return ()=>observer.disconnect();
  },[cycles]);
  return <div><div className="staging-cycle-heading meta">Cycle</div><div ref={ref} className="staging-cycles" tabIndex={0} role="region" aria-label="Complete cycle scorecards, scroll vertically for earlier cycles">{cycles.map(c=><article className="staging-cycle" key={c.cycle.id}><h3>{c.cycle.ordinal}</h3><PairedBars {...c}/></article>)}</div></div>;
}
const duration=(value:number)=>runtimeLabel(Math.round(value));
export function CycleReport({catalog,all,rows,filter,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;reportCache?:Map<string,unknown>}) {
 const cached=useStagingReports([catalog,all,rows,filter],reportCache,'core');
 const cycles=cached('cycles',()=>cycleScorecards(catalog,all,rows));
 return <Report title="Cycle scorecards" note="Average reception by complete cycle, latest first.">
    {cycles.length?<CycleWindow cycles={cycles}/>:<Empty/>}
  </Report>;
}
export function SpreadReports({catalog,all,rows,filter,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;reportCache?:Map<string,unknown>}) {
 const cached=useStagingReports([catalog,all,rows,filter],reportCache,'core');
 const spreads=cached('spreads',()=>(['year','runtime'] as const).map(dimension=>({dimension,...contributorSpreads(catalog,all,filter,dimension)})));
 return <>{spreads.map(report=><Report key={report.dimension} title={report.dimension==='year'?'Release-year spread':'Runtime spread'} note={report.dimension==='year'?'Mean release year and standard deviation spread, on a shared timeline.':'Shortest to longest runtime, with the mean marked.'}>
    {report.groups.map(g=>{const label=(n:number|null)=>n===null?'Unavailable':report.dimension==='year'?String(Math.round(n)):duration(n);return <div className="staging-chart-row" key={g.label}><Contributor catalog={catalog} filter={g.filter}/><div><Interval {...g} minimum={report.minimum} maximum={report.maximum} label={`${g.label}: mean ${label(g.mean)}, interval ${label(g.low)} to ${label(g.high)}, ${formatCount(g.count)} appearances`}/><p className="meta">Mean {label(g.mean)}{g.mean!==null&&<> · {report.dimension==='year'?`SD ${number(g.sd)} years`:`Shortest: ${label(g.low)} · Longest: ${label(g.high)}`}</>}</p></div></div>;})}<div className="staging-axis" aria-label={`Shared ${report.dimension} axis ${report.minimum} to ${report.maximum}`}><span>{report.dimension==='year'?report.minimum:duration(report.minimum)}</span><span>{report.dimension==='year'?report.maximum:duration(report.maximum)}</span></div>
  </Report>)}</>;
}
export function LeaningReport({catalog,all,rows,filter,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;reportCache?:Map<string,unknown>}) {
 const cached=useStagingReports([catalog,all,rows,filter],reportCache,'core');
 const leaning=cached('leaning',()=>contributorLeaning(catalog,all,filter));
 return <Report title="Critics or audiences?" note="Which group rates each contributor’s films higher?">
    {leaning.map(g=><div className="staging-chart-row" key={g.label}><Contributor catalog={catalog} filter={g.filter}/><div><div className="staging-diverging" role="img" aria-label={`${g.label}: ${g.critic} critic-higher, ${g.audience} audience-higher, ${g.neutral} neutral; ${g.leaning===null?'unavailable':`${number(Math.abs(g.leaning))}% ${g.leaning<0?'critic':g.leaning>0?'audience':'neutral'} leaning`}`}><span className="staging-critic-side" style={{width:`${g.count?g.critic/g.count*50:0}%`}}/><span className="staging-audience-side" style={{width:`${g.count?g.audience/g.count*50:0}%`}}/>{g.leaning!==null&&<span className="staging-net-marker" style={{left:`${50+g.leaning/2}%`}}/>}</div><p className="meta">{formatCount(g.critic)} critic / {formatCount(g.audience)} audience / {formatCount(g.neutral)} neutral · {g.leaning===null?'Unavailable':`${number(Math.abs(g.leaning))}% ${g.leaning<0?'critic':g.leaning>0?'audience':'neutral'} leaning`}</p></div></div>)}
  </Report>;
}
