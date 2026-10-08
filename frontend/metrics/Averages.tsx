import { ratingDimension } from '../../shared/rating-dimensions';
import { RatingCircles } from '../MetricsVisuals';

import { formatScore100 } from '../presentation';

import type { CatalogMetricsProps, EnrichedReportProps } from './report-types';

const money = (n: number | null) => n === null ? 'No reported data' : new Intl.NumberFormat('en-AU',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);

export function RatingsProfile({dashboard}: Pick<CatalogMetricsProps,'dashboard'>) {
  return <><div className="stack" data-metric="T"><section className="stack"><h3>Ratings Profile</h3><p className="meta">Mean /100 · genuine stored ratings · repeats count</p><div className="metrics-rating-profile">{dashboard.ratings.map(r => <div key={r.id} title={ratingDimension(r.provider,r.metric)?.profileName ?? r.name} aria-label={ratingDimension(r.provider,r.metric)?.profileName ?? r.name}><div className="stack"><div className="metrics-distribution-label"><span>{r.label}</span><strong>Mean {r.mean === null ? '—' : `${formatScore100(r.mean)} / 100`}</strong></div><RatingCircles mean={r.mean ?? 0} colour={r.colour} /><p className="meta">{r.median === null ? 'No scores' : `Median ${formatScore100(r.median)}`}</p></div></div>)}</div></section></div></>;
}

export function MedianEconomics({economics}: Pick<EnrichedReportProps,'economics'>) {
  return <section className="stack metrics-median-economics" data-metric="M"><h3>Median reported budget / revenue</h3><p className="meta">Reported USD · repeats count · non-positive amounts excluded.</p><div className="metrics-paired" data-metric="N">{economics.map(s => {
      const maximum = Math.max(1,s.report.budget.median ?? 0,s.report.revenue.median ?? 0);
      return <div className="stack metrics-economics-pair" key={s.label}><strong>{s.label}</strong><p className="meta">{s.report.budget.median !== null && s.report.revenue.median !== null ? `Median revenue ${(s.report.revenue.median/s.report.budget.median).toFixed(1)}x budget` : 'Median revenue / budget unavailable'}</p><div className="metrics-touching-bars"><div className="metrics-median-budget"><p className="meta">Budget · USD {money(s.report.budget.median).replace(/^USD\s*/, '')}</p><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${(s.report.budget.median ?? 0)/maximum*100}%`,background:'var(--carrot)'}} /></div></div><div className="metrics-median-revenue"><div className="metrics-distribution-track" aria-hidden="true"><span style={{width:`${(s.report.revenue.median ?? 0)/maximum*100}%`,background:'var(--grass)'}} /></div><p className="meta">Revenue · USD {money(s.report.revenue.median).replace(/^USD\s*/, '')}</p></div></div></div>;
    })}</div></section>;
}
