import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Catalog } from '../shared/types';
import { genreColour, metricsPalette, withCutoffTies, type Appearance, type MetricsFilter } from '../shared/metrics';
import { auCategories, comparisonScopes, facts, filmEconomics, revenueRatioRankings, fingerprint, themeFingerprint, languageCategories, recurringTalent, stackedProfile, talent, talentRoles, tasteDiversity, emptyEnrichmentMovie, type Dimension, type Fact, type MetricsEnrichment, type TalentRole } from '../shared/metrics-enrichment';
import { api } from './api';
import { MovieLink } from './components';

import type { MetricsTab } from './metrics-tabs';

const noData: MetricsEnrichment = {movies:{}};
const percentage = (n: number) => `${n.toFixed(1)}%`;
const money = (n: number | null) => n === null ? 'No reported data' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
export function useMetricsEnrichment() {
  const pending = useRef<Promise<MetricsEnrichment> | null>(null);
  const [data,setData] = useState<MetricsEnrichment>(noData);
  const [status,setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    pending.current ??= api.metricsEnrichment();
    void pending.current.then(result => { if (active) {setData(result);setStatus('ready');} },() => {if (active) setStatus('error');});
    return () => {active = false;};
  },[attempt]);
  return {data,status,retry:() => {pending.current = null;setAttempt(n => n+1);}};
}
function Bar({label,value,detail,width,colour = 'jeans'}: {label:string;value:string;detail:string;width:number;colour?:string}) {
  return <div className="metrics-distribution-row metrics-enriched-row" style={{'--chart-colour':`var(--${colour})`} as CSSProperties}><div className="metrics-distribution-label"><span>{label}</span><strong>{value}</strong></div><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,width))}%`}} /></div><p className="meta">{detail}</p></div>;
}
function Coverage({label,covered,total}: {label:string;covered:number;total:number}) {
  return <p className="meta">{total ? `${label} known for ${covered} / ${total} appearances.` : 'No film appearances for this selection.'}</p>;
}
type Scope = {label:string;rows:Appearance[]};
function Stacks({scopes,data,dimension,categories}: {scopes:Scope[];data:MetricsEnrichment;dimension:'language'|'classification';categories:Fact[]}) {
  return <div className="stack"><div className="metrics-stack-legend">{categories.map(c => <span key={c.id}><i aria-hidden="true" style={{background:`var(--${c.id === 'Unknown' ? 'asphalt' : genreColour(c.id)})`}} />{c.label}</span>)}</div>{scopes.map(scope => {
    const profile = stackedProfile(scope.rows,data,dimension);
    const counts = categories.map(c => ({...c,count:c.id === 'Other' ? [...profile.counts].filter(([id]) => id !== 'Unknown' && !categories.some(category => category.id === id && id !== 'Other')).reduce((sum,[,count]) => sum+count,0) : profile.counts.get(c.id) ?? 0}));
    // Classification Other is an actual bucket, whereas language Other collects the remainder.
    if (dimension === 'classification') counts.find(c => c.id === 'Other')!.count = profile.counts.get('Other') ?? 0;
    return <div className="stack metrics-stacked-profile" key={scope.label}><strong>{scope.label}</strong>{counts.filter(c => dimension === 'classification' || c.count).map(c => <Bar key={c.id} label={c.label} value={percentage(c.count/Math.max(1,profile.total)*100)} width={c.count/Math.max(1,...counts.map(c => c.count))*100} colour={c.id === 'Unknown' ? 'asphalt' : genreColour(c.id)} detail={`${c.count} appearances`} />)}{!profile.total && <p className="meta">No film appearances.</p>}<p className="meta">{dimension === 'language' ? 'Non-English original language' : 'MA15+ / R18+'}: {profile.headline === null ? 'No known data' : percentage(profile.headline)}{dimension === 'classification' ? ' · among known classifications.' : ''}</p></div>;
  })}</div>;
}
const reportedMoney = new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',maximumFractionDigits:0});
function RevenueRatios({rows,data}: {rows:Appearance[];data:MetricsEnrichment}) {
  const report = revenueRatioRankings(rows,data);
  return <section className="stack metrics-revenue-ratios"><h3>Reported revenue / reported budget</h3><p className="meta">{report.covered} / {report.unique} unique films have reported positive budget and revenue · USD.</p><div className="metrics-paired">{(['Top','Bottom'] as const).map(direction => <section className="stack" key={direction}><h3>{direction} 5 Revenue / Budget Ratio</h3>{report.covered ? <ol className="metrics-ratio-list" role="list">{(direction === 'Top' ? report.top : report.bottom).map((p,index) => <li key={p.movie.id}><span className="metrics-ratio-rank" aria-hidden="true">{index+1}.</span><div className="metrics-ratio-data"><MovieLink movie={p.movie}><span className="movie-title">{p.movie.title}</span></MovieLink><p className="meta">{p.movie.year ?? 'Year unknown'} · {p.ratio.toFixed(1)}×</p><p className="meta">Reported budget {reportedMoney.format(p.budget)} · Reported revenue {reportedMoney.format(p.revenue)}</p></div></li>)}</ol> : <p className="meta">No qualifying films for this selection.</p>}</section>)}</div></section>;
}
export function EnrichedMetrics({category,catalog,all,rows,filter,data,status,retry}: {category:MetricsTab;catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;status:string;retry:()=>void}) {
  const [role,setRole] = useState<TalentRole>('Cast');
  const scopes = useMemo(() => comparisonScopes(catalog,all,filter),[catalog,all,filter]);
  const isAll = filter.kind === 'all';
  const reader = (dimension:Dimension) => (row:Appearance) => facts(row,data,dimension);
  const themeReport = useMemo(() => themeFingerprint(rows,all,data,{distinctive:true,limit:Number.MAX_SAFE_INTEGER}),[rows,all,data]);
  const signatures = useMemo(() => scopes.map(s => ({...s,report:themeFingerprint(s.rows,all,data,{distinctive:true,limit:Number.MAX_SAFE_INTEGER})})),[scopes,all,data]);
  const talentReport = useMemo(() => {
    const report = fingerprint(rows,all,r => talent(r,data.movies[r.movie.id] ?? emptyEnrichmentMovie(),role),{qualifyingShare:true,limit:role === 'Cast' ? Number.MAX_SAFE_INTEGER : 10});
    return role === 'Cast' ? {...report,values:withCutoffTies(report.values,v => v.count)} : report;
  },[rows,all,data,role]);
  const language = useMemo(() => languageCategories(all,data),[all,data]);
  const economics = useMemo(() => scopes.map(s => ({...s,report:filmEconomics(s.rows,data)})),[scopes,data]);
  const diversity = useMemo(() => (['countries','languages','themes','directors','cast'] as const).map(dimension => ({dimension,values:scopes.map(s => ({label:s.label,...tasteDiversity(s.rows,data,dimension)}))})),[scopes,data]);
  const bars = (report:ReturnType<typeof fingerprint>,ratios:boolean) => report.values.length ? report.values.map(v => <Bar key={v.id} label={v.label} value={`${v.count} · ${percentage(v.percentage)}`} detail={ratios && v.ratio !== null ? `${v.ratio.toFixed(1)}x club` : 'Appearance count and share'} width={v.percentage} colour={v.colour} />) : <p className="meta">No qualifying evidence for this selection.</p>;
  const comparison = (report:ReturnType<typeof fingerprint>) => {
    const outliers = report.values.filter(v => (v.ratio ?? 0) > 1).slice(0,12);
    return outliers.length ? <ul className="metrics-theme-cloud">{outliers.map((v,index) => <li key={v.id} style={{color:`var(--${v.colour})`,fontSize:`${1.25-index*0.025}em`}}><span>{v.label}</span><strong>{v.ratio!.toFixed(1)}x club</strong></li>)}</ul> : <p className="meta">No positive theme outliers for this selection.</p>;
  };
  return <>{['fingerprints','general','averages','diversity','standalone','extremes'].includes(category) && status !== 'ready' && <div role="status" className="stack"><p className="meta">{status === 'loading' ? 'Loading enriched Metrics…' : 'Enriched Metrics could not load. Existing Metrics remains available.'}</p>{status === 'error' && <button type="button" onClick={retry}>Retry enriched Metrics</button>}</div>}
    {category === 'fingerprints' && <div className="metrics-paired"><section className="stack metrics-themes" data-metric="F"><h3>Theme fingerprint</h3><Coverage label="Themes" covered={themeReport.covered} total={rows.length} /><p className="meta">Keywords across both sources · signatures require two distinct films.</p>{isAll ? signatures.map(s => <div className="stack metrics-theme-signature" key={s.label}><strong>{s.label}</strong><Coverage label="Themes" covered={s.report.covered} total={s.rows.length} />{comparison(s.report)}</div>) : comparison(themeReport)}</section><section className="stack metrics-talent" data-metric="G"><h3>Talent fingerprint</h3><label className="stack">Role<select className="field__input" value={role} onChange={e => setRole(e.target.value as TalentRole)}>{talentRoles.map(r => <option key={r}>{r}</option>)}</select></label><Coverage label={role} covered={talentReport.covered} total={rows.length} /><p className="meta">Share of appearances with {role.toLowerCase()} evidence.{role === 'Director' && ' Exact director credits; shared credits stay together.'}</p>{talentReport.values.length ? talentReport.values.map(v => <div className="metrics-talent-row" key={v.id}><span>{v.label}</span><p className="meta">{v.count} appearances · {percentage(v.percentage)}{!isAll && v.ratio !== null ? ` · ${v.ratio.toFixed(1)}x club` : ''}</p></div>) : <p className="meta">No qualifying evidence for this selection.</p>}</section></div>}
    {['fingerprints','standalone','general'].includes(category) && <div className="metrics-paired">{(['countries','companies'] as const).filter(d => d === 'countries' ? category === 'standalone' : category === 'fingerprints').map(d => {
      const report = fingerprint(rows,all,reader(d),{distinctive:!isAll && d === 'countries',minimum:!isAll && d === 'companies' ? 2 : 1,limit:d === 'companies' ? 20 : Number.MAX_SAFE_INTEGER});
      return <section className={`stack metrics-${d}`} data-metric={d === 'countries' ? 'H' : 'J'} key={d}><h3>{d === 'countries' ? 'Production countries' : 'Studio fingerprint'}</h3><Coverage label={d === 'countries' ? 'Production country' : 'Production company'} covered={report.covered} total={rows.length} />{d === 'countries' && <p className="meta">{report.distinct} distinct production countries.</p>}<p className="meta">A film may have several {d === 'countries' ? 'production countries' : 'production companies'}; totals can exceed appearances.</p>{<div className="stack metrics-five-scroll" tabIndex={0} role="region" aria-label={d === 'countries' ? 'Production countries' : 'Studio fingerprint'}>{bars(report,!isAll)}</div>}</section>;
    })}{category === 'standalone' && <section className="stack metrics-languages" data-metric="I"><h3>Original-language profile</h3><Stacks scopes={scopes} data={data} dimension="language" categories={language} /></section>}{category === 'general' && <section className="stack metrics-classifications" data-metric="K"><h3>Australian classification</h3><Stacks scopes={scopes} data={data} dimension="classification" categories={auCategories.map(id => ({id,label:id}))} /></section>}</div>}
    {category === 'standalone' && <div data-metric="L"><RevenueRatios rows={rows} data={data} /></div>}{category === 'averages' && <section className="stack metrics-median-economics" data-metric="M"><h3>Median reported budget / revenue</h3><p className="meta">Reported USD · repeats count · non-positive amounts excluded.</p><div className="metrics-paired" data-metric="N">{economics.map(s => {
      const maximum = Math.max(1,s.report.budget.median ?? 0,s.report.revenue.median ?? 0);
      return <div className="stack metrics-economics-pair" key={s.label}><strong>{s.label}</strong><div className="metrics-touching-bars"><div className="metrics-median-budget"><p className="meta">Budget · USD {money(s.report.budget.median).replace(/^USD\s*/, '')}</p><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${(s.report.budget.median ?? 0)/maximum*100}%`,background:'var(--mandarin)'}} /></div></div><div className="metrics-median-revenue"><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${(s.report.revenue.median ?? 0)/maximum*100}%`,background:'var(--grass)'}} /></div><p className="meta">Revenue · USD {money(s.report.revenue.median).replace(/^USD\s*/, '')}</p></div></div></div>;
    })}</div></section>}
    {category === 'diversity' && <section className="stack metrics-section metrics-diversity"><h2>Taste diversity</h2><p className="meta">Distinct values per 10 appearances. Raw variety shown below each bar; smaller samples can vary more. Recurring cast requires two appearances.</p><div className="metrics-paired">{diversity.map(d => <section className="stack" data-metric={({countries:'O',languages:'P',themes:'Q',directors:'R',cast:'S'} as const)[d.dimension]} key={d.dimension}><h3>{({countries:'Production countries',languages:'Original languages',themes:'Themes',directors:'Directors',cast:'Recurring cast'} as const)[d.dimension]}</h3><p className="meta">{({countries:'How many different production countries appear per 10 films. Higher means a wider geographic spread.',languages:'How many different original languages appear per 10 films. Higher means a broader language mix.',themes:'How many distinct themes appear per 10 films. Higher means a broader range of themes.',directors:'How many different directors appear per 10 films. Higher means selections span more filmmakers.',cast:'How many cast members recur across at least two appearances, per 10 films. Counts recurring cast, rather than one-off appearances.'} as const)[d.dimension]}</p>{d.values.map((v,index) => <Bar colour={index % 2 === 0 ? 'jeans' : 'lavender'} key={v.label} label={v.label} value={v.perTen === null ? 'No evidence' : `${v.perTen.toFixed(1)} per 10`} width={(v.perTen ?? 0)/Math.max(1,...d.values.map(other => other.perTen ?? 0))*100} detail={`${v.distinct.toLocaleString('en-AU')} distinct`} />)}</section>)}</div></section>}
  </>;
}
export function CreatorExtremes({rows,data,colourOffset}: {rows:Appearance[];data:MetricsEnrichment;colourOffset:number}) {
  const reports = useMemo(() => talentRoles.filter(role => role !== 'Cast').map(role => ({role,...recurringTalent(rows,data,role)})),[rows,data]);
  return <>{reports.map((report,index) => <section className="stack metrics-creator-extreme" key={report.role}><h3 style={{'--extreme-colour':`var(--${metricsPalette[(index+colourOffset)%metricsPalette.length]})`} as CSSProperties}>Most recurring {report.role}</h3>{report.extreme ? <><p className="meta">{report.extreme.items.length > 1 ? `${report.extreme.items.length}-way tie · ` : ''}{report.extreme.value} appearances</p>{report.extreme.items.map(item => <span key={item.id}>{item.label}</span>)}</> : <p className="meta">No repeat {report.role.toLowerCase()} yet</p>}</section>)}</>;
}
