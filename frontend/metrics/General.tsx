import { ClubIdentity } from '../ClubIdentity';
import { ScoreAbbreviationsHelp } from '../components';
import { catalogIndex } from '../../shared/catalog-index';
import type { Catalog } from '../../shared/types';
import type { MetricsFilter } from '../../shared/metrics';
import { ratingDimension } from '../../shared/rating-dimensions';
import { RatingCircles } from '../MetricsVisuals';
import { formatScore100 } from '../presentation';
import type { filmEconomics } from '../../shared/metrics-enrichment';
import { formatCount } from '../../shared/format';



import type { CatalogMetricsProps } from './report-types';

export function ContributionReport({contributions}: Pick<CatalogMetricsProps,'contributions'>) {
  return <div className="stack" data-metric="B"><section className="stack metrics-section"><h2>Contribution by host</h2><figure className="comparison-chart"><figcaption>Films brought</figcaption>{contributions.map((row,index) => <div className="chart-row" key={row.label}><span>{row.label}</span><span className="chart-track" aria-hidden="true"><span className={index % 2 === 0 ? 'chart-bar-jeans' : 'chart-bar-lavender'} style={{width:`${row.count/Math.max(1,...contributions.map(r => r.count))*100}%`}} /></span><strong>{formatCount(row.count)}</strong></div>)}</figure></section></div>;
}

export function ReleaseDecadesReport({dashboard}: Pick<CatalogMetricsProps,'dashboard'>) {
  const decadeLabel = (label: string) => /^\d{4}s$/.test(label) ? `'${label.slice(2)}` : label;
  const commonDecade = [...dashboard.decades].sort((a,b) => b.count-a.count)[0];
  return <div className="stack" data-metric="D"><section className="stack metrics-decades"><h3>Release decades</h3>{commonDecade && <p className="meta">Most common: {commonDecade.label} · {commonDecade.percentage.toFixed(1)}%</p>}{dashboard.decades.length ? <><div className="metrics-stack-bar" aria-hidden="true">{dashboard.decades.map(d => <span key={d.label} style={{width:`${d.percentage}%`,background:`var(--${d.colour})`}} />)}</div><div className="metrics-stack-legend metrics-decade-legend">{dashboard.decades.map(d => <span key={d.label}><i aria-hidden="true" style={{background:`var(--${d.colour})`}} /><span>{decadeLabel(d.label)}</span><span>{d.percentage.toFixed(1)}%</span></span>)}</div></> : <p className="meta">No film appearances yet.</p>}</section></div>;
}

export function GenreDetailReport({metrics}: Pick<CatalogMetricsProps,'metrics'>) {
  return <div className="stack" data-metric="Y"><section className="stack metrics-section"><h2>Genre detail</h2><p className="meta">Multi genre films count once in each.</p>{metrics.genres.length ? <div className="metrics-genre-scroll" tabIndex={0} role="region" aria-label="Genre detail"><table className="metrics-table"><thead><tr><th scope="col">Genre</th><th scope="col" aria-label="Appearance count">Count</th><th scope="col">Share</th><th scope="col">IMDb</th></tr></thead><tbody>{metrics.genres.map(g => <tr key={g.genre}><th scope="row">{g.genre}</th><td>{formatCount(g.appearances)}</td><td>{g.percentage.toFixed(1)}%</td><td>{g.imdbAverage === null ? 'No scores' : g.imdbAverage.toFixed(2)}</td></tr>)}</tbody></table></div> : <p className="meta">No film appearances yet.</p>}</section></div>;
}

export function RatingsProfile({dashboard}: Pick<CatalogMetricsProps,'dashboard'>) {
  return <><div className="stack" data-metric="T"><section className="stack"><div className="metrics-ratings-heading"><h3>Ratings profile</h3><ScoreAbbreviationsHelp /></div><p className="meta">Mean /100</p><div className="metrics-rating-profile">{dashboard.ratings.map(r => <div key={r.id} title={ratingDimension(r.provider,r.metric)?.profileName ?? r.name} aria-label={ratingDimension(r.provider,r.metric)?.profileName ?? r.name}><div className="stack"><div className="metrics-distribution-label"><span>{r.label}</span><strong>Mean {r.mean === null ? '—' : `${formatScore100(r.mean)} / 100`}</strong></div><RatingCircles mean={r.mean ?? 0} colour={r.colour} /><p className="meta">{r.median === null ? 'No scores' : `Median ${formatScore100(r.median)}`}</p></div></div>)}</div></section></div></>;
}


const moneyFormatter = new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const money = (value:number|null)=>value===null?'No reported data':moneyFormatter.format(value).replace(/^USD\s*/,'');
const medianRatio = (report:ReturnType<typeof filmEconomics>)=>{
  const value=report.budget.median!==null && report.revenue.median!==null?report.revenue.median/report.budget.median:null;
  return value!==null && Number.isFinite(value) && value>0?`Median revenue ${value.toFixed(1)}x budget`:'Median revenue / budget unavailable';
};
export function MedianEconomics({catalog,economics,maximum}: {catalog:Catalog;economics:{label:string;filter:MetricsFilter;report:ReturnType<typeof filmEconomics>}[];maximum:number}) {
  const width=(value:number|null)=>maximum>0?(value ?? 0)/maximum*100:0;
  return <section className="stack metrics-median-economics" data-metric="M"><h3>Median reported budget / revenue</h3><p className="meta">Reported USD</p>
    <div className="metrics-contributor-chart metrics-economics-chart" data-metric="N">{economics.map(group=><div className="metrics-economics-row" key={group.label}>
      <div className="metrics-economics-identity">{group.filter.kind==='classics' ? <ClubIdentity identity={{kind:'classics'}} /> : group.filter.kind==='member' && catalogIndex(catalog).memberById.has(group.filter.memberId) ? <ClubIdentity identity={{kind:'member',member:catalogIndex(catalog).memberById.get(group.filter.memberId)!}} /> : <span>{group.label}</span>}</div><div className="stack metrics-economics-pair">
      <div className="metrics-touching-bars"><div className="metrics-median-budget"><div className="metrics-budget-heading meta"><span>Budget · USD {money(group.report.budget.median)}</span><span>{medianRatio(group.report)}</span></div><div className="metrics-distribution-track" role="img" aria-label={`Median budget USD ${group.report.budget.median ?? 'unavailable'}`}><span style={{width:`${width(group.report.budget.median)}%`,background:'var(--carrot)'}} /></div></div>
      <div className="metrics-median-revenue"><div className="metrics-distribution-track" role="img" aria-label={`Median revenue USD ${group.report.revenue.median ?? 'unavailable'}`}><span style={{width:`${width(group.report.revenue.median)}%`,background:'var(--grass)'}} /></div><p className="meta">Revenue · USD {money(group.report.revenue.median)}</p></div></div></div>
    </div>)}<div className="metrics-economics-axis meta" aria-label={`Shared USD axis, zero to ${maximum}`}><span>USD 0</span><span>{maximum>0?`USD ${moneyFormatter.format(maximum/2).replace(/^USD\s*/,'')}`:'No reported data'}</span><span>{maximum>0?`USD ${moneyFormatter.format(maximum).replace(/^USD\s*/,'')}`:''}</span></div></div>
  </section>;
}
