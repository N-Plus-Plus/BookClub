import { formatCount } from '../../shared/format';
import { MovieLink } from '../components';

import { MetricsResults } from '../MetricsResults';

import { revenueRatioRankings } from '../../shared/metrics-enrichment';

import type { CatalogMetricsProps, EnrichedReportProps } from './report-types';

const reportedMoney = new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',maximumFractionDigits:0});
function RevenueRatios({report}: {report:ReturnType<typeof revenueRatioRankings>}) {
  return <section className="stack metrics-revenue-ratios"><div className="metrics-paired">{(['Top','Bottom'] as const).map(direction => <section className="stack" key={direction}><h3>{direction} 5 revenue / budget ratio</h3>{report.covered ? <ol className="metrics-ratio-list" role="list">{<MetricsResults list label={`${direction} revenue ratios`} items={direction === 'Top' ? report.top : report.bottom} render={(p,index) => <li key={p.movie.id}><span className="metrics-ratio-rank" aria-hidden="true">{index+1}.</span><div className="metrics-ratio-data"><MovieLink movie={p.movie}><span className="movie-title">{p.movie.title}</span></MovieLink><p className="meta">{p.movie.year ?? 'Year unknown'} · {p.ratio.toFixed(1)}×</p><dl className="metrics-reported-money meta"><div><dt>Reported budget USD</dt><dd>{reportedMoney.format(p.budget).replace(/^USD\s*/,'$')}</dd></div><div><dt>Reported revenue USD</dt><dd>{reportedMoney.format(p.revenue).replace(/^USD\s*/,'$')}</dd></div></dl></div></li>} />} </ol> : <p className="meta">No qualifying films for this selection.</p>}</section>)}</div></section>;
}

export function GeneralMetrics({dashboard,metrics,contributions}: Pick<CatalogMetricsProps,'dashboard'|'metrics'|'contributions'>) {
  const decadeLabel = (label: string) => /^\d{4}s$/.test(label) ? `'${label.slice(2)}` : label;
  const commonDecade = [...dashboard.decades].sort((a,b) => b.count-a.count)[0];
  return <><div className="stack" data-metric="B"><section className="stack metrics-section"><h2>Contribution by host</h2><figure className="comparison-chart"><figcaption>Films brought</figcaption>{contributions.map((row,index) => <div className="chart-row" key={row.label}><span>{row.label}</span><span className="chart-track" aria-hidden="true"><span className={index % 2 === 0 ? 'chart-bar-jeans' : 'chart-bar-lavender'} style={{width:`${row.count/Math.max(1,...contributions.map(r => r.count))*100}%`}} /></span><strong>{formatCount(row.count)}</strong></div>)}</figure></section></div><div className="stack" data-metric="D"><section className="stack metrics-decades"><h3>Release decades</h3>{commonDecade && <p className="meta">Most common: {commonDecade.label} · {commonDecade.percentage.toFixed(1)}%</p>}{dashboard.decades.length ? <><div className="metrics-stack-bar" aria-hidden="true">{dashboard.decades.map(d => <span key={d.label} style={{width:`${d.percentage}%`,background:`var(--${d.colour})`}} />)}</div><div className="metrics-stack-legend metrics-decade-legend">{dashboard.decades.map(d => <span key={d.label}><i aria-hidden="true" style={{background:`var(--${d.colour})`}} /><span>{decadeLabel(d.label)}</span><span>{d.percentage.toFixed(1)}%</span></span>)}</div></> : <p className="meta">No film appearances yet.</p>}</section></div><div className="stack" data-metric="Y"><section className="stack metrics-section"><h2>Genre detail</h2><p className="meta">Multi genre films count once in each.</p>{metrics.genres.length ? <div className="metrics-genre-scroll" tabIndex={0} role="region" aria-label="Genre detail"><table className="metrics-table"><thead><tr><th scope="col">Genre</th><th scope="col" aria-label="Appearance count">Count</th><th scope="col">Share</th><th scope="col">IMDb</th></tr></thead><tbody>{metrics.genres.map(g => <tr key={g.genre}><th scope="row">{g.genre}</th><td>{formatCount(g.appearances)}</td><td>{g.percentage.toFixed(1)}%</td><td>{g.imdbAverage === null ? 'No scores' : g.imdbAverage.toFixed(2)}</td></tr>)}</tbody></table></div> : <p className="meta">No film appearances yet.</p>}</section></div></>;
}

export function GeneralEconomics({rows,data,cached}: Pick<EnrichedReportProps,'rows'|'data'|'cached'>) {

  return <div data-metric="L"><RevenueRatios report={cached('revenueRatios',()=>revenueRatioRankings(rows,data))} /></div>;
}
