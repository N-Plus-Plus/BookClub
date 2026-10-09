import { formatCount } from '../../shared/format';
import { ComparisonBars } from '../MetricsVisuals';
import { metricsPalette } from '../../shared/metrics';


import type { fingerprint } from '../../shared/metrics-enrichment';

import type { CatalogMetricsProps, EnrichedReportProps } from './report-types';


export function GenreFingerprint({filter,dashboard,contributions}: Pick<CatalogMetricsProps,'filter'|'dashboard'|'contributions'>) {
  return <><div className="stack" data-metric="C"><section className="stack metrics-fingerprint"><h3>Genre fingerprint</h3><p className="meta">{filter.kind === 'all' ? 'Each contributor’s signature against the whole club.' : 'Distinctive genres compared with the whole club.'}</p>{filter.kind === 'all' ? contributions.map((row,index) => <div className="metrics-signature" key={row.label}><strong>{row.label}</strong>{row.signature ? <ComparisonBars selectedLabel="Brought" clubLabel="vs. Club" ratio={row.signature.ratio} label={row.signature.genre} value={`${row.signature.ratio.toFixed(1)}x club`} detail="" colour={index % 2 === 0 ? 'jeans' : 'lavender'} /> : <span className="meta">No recognised genres</span>}</div>) : dashboard.fingerprint.length ? dashboard.fingerprint.map(g => <ComparisonBars selectedLabel="Brought" clubLabel="vs. Club" ratio={g.ratio} key={g.genre} label={g.genre} value={`${g.ratio.toFixed(1)}x club`} detail="" colour={g.colour} />) : <p className="meta">No recognised genres for this selection.</p>}</section></div></>;
}

export function EnrichedFingerprints({isAll,themeReport,signatures}: Pick<EnrichedReportProps,'isAll'|'themeReport'|'signatures'>) {
  const comparison = (report:ReturnType<typeof fingerprint>) => {
    const keywords = report.values;
    return keywords.length ? <ul className="metrics-theme-cloud">{keywords.map((v,index) => <li key={v.id} style={{color:`var(--${metricsPalette[index % metricsPalette.length]})`,fontSize:`${1.25-index*0.025}em`}}><span>{v.label}</span><strong>{formatCount(v.count)}, {v.ratio!.toFixed(1)}x club</strong></li>)}</ul> : <p className="meta">No eligible keywords for this selection.</p>;
  };
  return <><section className="stack metrics-themes" data-metric="F"><h3>Theme fingerprint</h3><p className="meta">Most frequent keywords for each boob.</p>{isAll ? signatures.map(s => <div className="stack metrics-theme-signature" key={s.label}><strong>{s.label}</strong>{comparison(s.report)}</div>) : comparison(themeReport)}</section></>;
}
