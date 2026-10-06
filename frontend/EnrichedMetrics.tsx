import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Catalog } from '../shared/types';
import { genreColour, type Appearance, type MetricsFilter } from '../shared/metrics';
import { auCategories, comparisonScopes, facts, filmEconomics, fingerprint, languageCategories, recurringTalent, stackedProfile, talent, talentRoles, tasteDiversity, emptyEnrichmentMovie, type Dimension, type Fact, type MetricsEnrichment, type TalentRole } from '../shared/metrics-enrichment';
import { api } from './api';
import { MovieLink } from './components';

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
    return <div className="stack metrics-stacked-profile" key={scope.label}><strong>{scope.label}</strong><div className="metrics-stack-bar" aria-hidden="true">{counts.filter(c => c.count).map(c => <span key={c.id} style={{width:`${c.count/Math.max(1,profile.total)*100}%`,background:`var(--${c.id === 'Unknown' ? 'asphalt' : genreColour(c.id)})`}} />)}</div><p className="meta">{profile.total ? counts.filter(c => c.count).map(c => `${c.label} ${percentage(c.count/profile.total*100)} (${c.count})`).join(' · ') : 'No film appearances.'}</p><p className="meta">{dimension === 'language' ? 'Non-English original language' : 'MA15+ / R18+'}: {profile.headline === null ? 'No known data' : percentage(profile.headline)} · among known {dimension === 'language' ? 'languages' : 'classifications'}.</p><Coverage label={dimension === 'language' ? 'Original language' : 'AU classification'} covered={profile.covered} total={profile.total} /></div>;
  })}</div>;
}
function Scatter({rows,data,catalog}: {rows:Appearance[];data:MetricsEnrichment;catalog:Catalog}) {
  const report = useMemo(() => filmEconomics(rows,data),[rows,data]);
  const container = useRef<HTMLElement | null>(null);
  const [width,setWidth] = useState(600);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(220,Math.floor(entries[0].contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  },[]);
  const [activeId,setActiveId] = useState<string | null>(null);
  const touchInspection = useRef(false);
  const active = report.points.find(p => p.movie.id === activeId);
  const bounds = (key:'budget'|'revenue') => {
    const values = report.points.map(p => Math.log10(p[key]));
    const low = Math.floor(Math.min(...values)),high = Math.max(low+1,Math.ceil(Math.max(...values)));
    return {low,high};
  };
  const x = bounds('budget'), y = bounds('revenue');
  const px = (value:number) => 75+(Math.log10(value)-x.low)/(x.high-x.low)*(width-110);
  const py = (value:number) => 290-(Math.log10(value)-y.low)/(y.high-y.low)*260;
  const hosts = (ids:string[]) => ids.map(id => id === 'CLSC' ? id : catalog.members.find(m => m.id === id)?.display_name.toUpperCase() || 'Host unknown').join(', ');
  const describe = (p:typeof report.points[number]) => `${p.movie.title} (${p.movie.year ?? 'Year unknown'}) · Budget ${money(p.budget)} · Revenue ${money(p.revenue)} · ${hosts(p.hosts)}`;
  return <section ref={container} className="stack metrics-economics-scatter"><h3>Budget vs revenue</h3><p className="meta">{report.unique ? `${report.points.length} / ${report.unique} unique films have both reported budget and revenue.` : 'No unique films for this selection.'} Reported USD · logarithmic spacing on both axes.</p>{report.points.length ? <><svg className="metrics-scatter" viewBox={`0 0 ${width} 350`} role="group" aria-label="Reported budget versus reported revenue, logarithmic axes"><line x1="75" y1="290" x2={width-30} y2="290" /><line x1="75" y1="30" x2="75" y2="290" />{Array.from({length:width < 390 ? 2 : 3},(_,i) => {
    const fraction = i/(width < 390 ? 1 : 2),xv = 10**(x.low+(x.high-x.low)*fraction),yv = 10**(y.low+(y.high-y.low)*fraction);
    return <g key={i}><text x={px(xv)} y="314" textAnchor="middle">{money(xv)}</text><text x="68" y={py(yv)+4} textAnchor="end">{money(yv)}</text></g>;
  })}<text x={(75+width-35)/2} y="342" textAnchor="middle">Reported budget (USD)</text><text x="14" y="160" transform="rotate(-90 14 160)" textAnchor="middle">Reported revenue (USD)</text>{report.points.map(p => <a key={p.movie.id} href={`#/movie/${encodeURIComponent(p.movie.id)}`} aria-label={describe(p)} onPointerDown={event => {touchInspection.current = event.pointerType === 'touch' && activeId !== p.movie.id;}} onFocus={() => setActiveId(p.movie.id)} onMouseEnter={() => setActiveId(p.movie.id)} onClick={event => {if (touchInspection.current || activeId !== p.movie.id) {event.preventDefault();setActiveId(p.movie.id);} touchInspection.current = false;}}><title>{describe(p)}</title><circle cx={px(p.budget)} cy={py(p.revenue)} r="22" className="metrics-scatter-target" /><circle cx={px(p.budget)} cy={py(p.revenue)} r="4" /></a>)}</svg><label className="stack">Inspect a film<select className="field__input" value={active?.movie.id ?? ''} onChange={e => setActiveId(e.target.value || null)}><option value="">Choose a film</option>{report.points.map(p => <option key={p.movie.id} value={p.movie.id}>{p.movie.title} ({p.movie.year ?? 'Year unknown'})</option>)}</select></label><div className="metrics-scatter-detail" aria-live="polite">{active ? <MovieLink movie={active.movie}>{describe(active)} · Open Film Detail</MovieLink> : <p className="meta">Focus, hover or tap a film to see its reported amounts. Tap again to open Film Detail.</p>}</div></> : <p className="meta">No films with both reported amounts for this selection.</p>}</section>;
}
export function EnrichedMetrics({catalog,all,rows,filter,data,status,retry}: {catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;status:string;retry:()=>void}) {
  const [role,setRole] = useState<TalentRole>('Cast');
  const scopes = useMemo(() => comparisonScopes(catalog,all,filter),[catalog,all,filter]);
  const isAll = filter.kind === 'all';
  const reader = (dimension:Dimension) => (row:Appearance) => facts(row,data,dimension);
  const themeReport = useMemo(() => fingerprint(rows,all,r => facts(r,data,'themes'),{distinctive:!isAll,minimum:2}),[rows,all,data,isAll]);
  const signatures = useMemo(() => scopes.map(s => ({...s,report:fingerprint(s.rows,all,r => facts(r,data,'themes'),{distinctive:true,minimum:2,limit:3})})),[scopes,all,data]);
  const talentReport = useMemo(() => fingerprint(rows,all,r => talent(r,data.movies[r.movie.id] ?? emptyEnrichmentMovie(),role),{qualifyingShare:true}),[rows,all,data,role]);
  const language = useMemo(() => languageCategories(all,data),[all,data]);
  const economics = useMemo(() => scopes.map(s => ({...s,report:filmEconomics(s.rows,data)})),[scopes,data]);
  const diversity = useMemo(() => (['countries','languages','themes','directors','cast'] as const).map(dimension => ({dimension,values:scopes.map(s => ({label:s.label,...tasteDiversity(s.rows,data,dimension)}))})),[scopes,data]);
  const bars = (report:ReturnType<typeof fingerprint>,ratios:boolean) => report.values.length ? report.values.map(v => <Bar key={v.id} label={v.label} value={`${v.count} · ${percentage(v.percentage)}`} detail={ratios && v.ratio !== null ? `${v.ratio.toFixed(1)}x club` : 'Appearance count and share'} width={v.percentage} colour={v.colour} />) : <p className="meta">No qualifying evidence for this selection.</p>;
  return <>{status !== 'ready' && <div role="status" className="stack"><p className="meta">{status === 'loading' ? 'Loading enriched Metrics…' : 'Enriched Metrics could not load. Existing Metrics remains available.'}</p>{status === 'error' && <button type="button" onClick={retry}>Retry enriched Metrics</button>}</div>}
    <section className="stack metrics-section"><h2>Themes &amp; Talent</h2><div className="metrics-paired"><section className="stack metrics-themes"><h3>Theme fingerprint</h3><Coverage label="Themes" covered={themeReport.covered} total={rows.length} /><p className="meta">Exact keyword matches across both sources · signatures require two appearances.</p>{isAll ? signatures.map(s => <div className="stack metrics-theme-signature" key={s.label}><strong>{s.label}</strong><Coverage label="Themes" covered={s.report.covered} total={s.rows.length} />{bars(s.report,true)}</div>) : bars(themeReport,true)}</section><section className="stack metrics-talent"><h3>Talent fingerprint</h3><label className="stack">Role<select className="field__input" value={role} onChange={e => setRole(e.target.value as TalentRole)}>{talentRoles.map(r => <option key={r}>{r}</option>)}</select></label><Coverage label={role} covered={talentReport.covered} total={rows.length} /><p className="meta">Share of appearances with {role.toLowerCase()} evidence.{role === 'Director' && ' Exact director credits; shared credits stay together.'}</p>{bars(talentReport,!isAll)}</section></div></section>
    <section className="stack metrics-section"><h2>World cinema</h2><div className="metrics-paired">{(['countries','companies'] as const).map(d => {
      const report = fingerprint(rows,all,reader(d),{distinctive:!isAll && d === 'countries',minimum:!isAll && d === 'companies' ? 2 : 1,limit:d === 'countries' ? 12 : 10});
      return <section className={`stack metrics-${d}`} key={d}><h3>{d === 'countries' ? 'Production countries' : 'Studio fingerprint'}</h3><Coverage label={d === 'countries' ? 'Production country' : 'Production company'} covered={report.covered} total={rows.length} />{d === 'countries' && <p className="meta">{report.distinct} distinct production countries.</p>}<p className="meta">A film may have several {d === 'countries' ? 'production countries' : 'production companies'}; totals can exceed appearances.</p>{bars(report,!isAll)}</section>;
    })}<section className="stack metrics-languages"><h3>Original-language profile</h3><Stacks scopes={scopes} data={data} dimension="language" categories={language} /></section><section className="stack metrics-classifications"><h3>Australian classification</h3><Stacks scopes={scopes} data={data} dimension="classification" categories={auCategories.map(id => ({id,label:id}))} /></section></div></section>
    <section className="stack metrics-section"><h2>Film economics</h2><Scatter rows={rows} data={data} catalog={catalog} /><div className="metrics-paired">{(['budget','revenue'] as const).map(key => <section className={`stack metrics-median-${key}`} key={key}><h3>Median reported {key}</h3><p className="meta">Reported USD · repeats count · non-positive amounts excluded.</p>{economics.map(s => <Bar key={s.label} label={s.label} value={money(s.report[key].median)} width={(s.report[key].median ?? 0)/Math.max(1,...economics.map(e => e.report[key].median ?? 0))*100} detail={s.rows.length ? `${s.report[key].covered} / ${s.rows.length} appearances with data` : 'No film appearances.'} />)}</section>)}</div></section>
    <section className="stack metrics-section metrics-diversity"><h2>Taste diversity</h2><p className="meta">Distinct values per 10 appearances with evidence. Raw variety and coverage shown below each bar; smaller samples can vary more. Recurring cast requires two appearances.</p><div className="metrics-paired">{diversity.map(d => <section className="stack" key={d.dimension}><h3>{({countries:'Production countries',languages:'Original languages',themes:'Themes',directors:'Directors',cast:'Recurring cast'} as const)[d.dimension]}</h3>{d.values.map(v => <Bar key={v.label} label={v.label} value={v.perTen === null ? 'No evidence' : `${v.perTen.toFixed(1)} per 10`} width={(v.perTen ?? 0)/Math.max(1,...d.values.map(other => other.perTen ?? 0))*100} detail={`${v.distinct} distinct · ${v.total ? `${v.covered} / ${v.total} appearances with evidence` : 'No film appearances'}`} />)}</section>)}</div></section>
  </>;
}
export function CreatorExtremes({rows,data}: {rows:Appearance[];data:MetricsEnrichment}) {
  const reports = useMemo(() => talentRoles.filter(role => role !== 'Cast').map(role => ({role,...recurringTalent(rows,data,role)})),[rows,data]);
  return <>{reports.map(report => <section className="stack metrics-creator-extreme" key={report.role}><h3>Most recurring {report.role}</h3><Coverage label={report.role} covered={report.covered} total={rows.length} />{report.extreme ? <><strong>{report.extreme.items.length > 1 ? `${report.extreme.items.length}-way tie · ` : ''}{report.extreme.value} appearances</strong>{report.extreme.items.map(item => <span key={item.id}>{item.label}</span>)}</> : <p className="meta">No repeat {report.role.toLowerCase()} yet</p>}</section>)}</>;
}
