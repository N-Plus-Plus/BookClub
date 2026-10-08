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
  return <div ref={ref} className="staging-cycles" tabIndex={0} role="region" aria-label="Complete cycle scorecards, scroll vertically for earlier cycles">{cycles.map(c=><article className="staging-cycle" key={c.cycle.id}><h3>Cycle {c.cycle.ordinal}{c.cycle.title?` · ${c.cycle.title}`:''}</h3><PairedBars {...c}/></article>)}</div>;
}

export function CoreReports({catalog,all,rows,filter,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;reportCache?:Map<string,unknown>}) {
  const cached=useStagingReports([catalog,all,rows,filter],reportCache,'core');
  const cycles=cached('cycles',()=>cycleScorecards(catalog,all,rows));
  const spreads=cached('spreads',()=>(['year','runtime'] as const).map(dimension=>({dimension,...contributorSpreads(catalog,all,filter,dimension)})));
  const leaning=cached('leaning',()=>contributorLeaning(catalog,all,filter));
  return <><Report title="Cycle scorecards" note="Complete five-turn cycles, latest first. Means count available scored film appearances within each complete club cycle; scroll for earlier cycles.">
    {cycles.length?<CycleWindow cycles={cycles}/>:<Empty/>}
  </Report>{spreads.map(report=><Report key={report.dimension} title={report.dimension==='year'?'Release-year spread':'Runtime spread'} note={report.dimension==='year'?'Mean release year ± one population standard deviation, not the observed range. Counts film appearances with known years. The shared axis includes all five contributors.':'Observed shortest to longest runtime, with a mean marker. Counts appearances with known runtimes. The shared axis includes all five contributors.'}>
    {report.groups.map(g=>{const label=(n:number|null)=>report.dimension==='year'?number(n):n===null?'Unavailable':runtimeLabel(n);return <div className="staging-chart-row" key={g.label}><Contributor catalog={catalog} filter={g.filter}/><div><Interval {...g} minimum={report.minimum} maximum={report.maximum} label={`${g.label}: mean ${label(g.mean)}, interval ${label(g.low)} to ${label(g.high)}, ${formatCount(g.count)} appearances`}/><p className="meta">Mean {label(g.mean)} · {formatCount(g.count)} known{g.mean!==null&&<> · {report.dimension==='year'?`SD ${number(g.sd)} years`:`${label(g.low)}–${label(g.high)}`}</>}</p></div></div>;})}<div className="staging-axis" aria-label={`Shared ${report.dimension} axis ${report.minimum} to ${report.maximum}`}><span>{report.dimension==='year'?report.minimum:runtimeLabel(report.minimum)}</span><span>{report.dimension==='year'?report.maximum:runtimeLabel(report.maximum)}</span></div>
  </Report>)}<Report title="Critics or audiences?" note="External reception of selections, not personal reviews. Net leaning = (audience-higher − critic-higher) / all eligible comparisons. Each film appearance counts once, including neutral ties.">
    {leaning.map(g=><div className="staging-chart-row" key={g.label}><Contributor catalog={catalog} filter={g.filter}/><div><div className="staging-diverging" role="img" aria-label={`${g.label}: ${g.critic} critic-higher, ${g.audience} audience-higher, ${g.neutral} neutral; ${g.leaning===null?'unavailable':`${number(Math.abs(g.leaning))}% ${g.leaning<0?'critic':g.leaning>0?'audience':'neutral'} leaning`}`}><span className="staging-critic-side" style={{width:`${g.count?g.critic/g.count*50:0}%`}}/><span className="staging-audience-side" style={{width:`${g.count?g.audience/g.count*50:0}%`}}/>{g.leaning!==null&&<span className="staging-net-marker" style={{left:`${50+g.leaning/2}%`}}/>}</div><p className="meta">{g.leaning===null?'Unavailable':`${number(Math.abs(g.leaning))}% ${g.leaning<0?'critic':g.leaning>0?'audience':'neutral'} leaning`} · {formatCount(g.critic)} critic / {formatCount(g.audience)} audience / {formatCount(g.neutral)} neutral{g.count>0&&` (${number(g.critic/g.count*100)}% / ${number(g.audience/g.count*100)}% / ${number(g.neutral/g.count*100)}%)`}</p></div></div>)}<div className="staging-axis"><span>−100% critics</span><span>0</span><span>+100% audiences</span></div>
  </Report></>;
}
