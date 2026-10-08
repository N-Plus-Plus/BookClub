import { ComparisonBars } from '../MetricsVisuals';
import { metricsPalette } from '../../shared/metrics';

import { MetricsResults } from '../MetricsResults';

import { talentRoles, type TalentRole, fingerprint } from '../../shared/metrics-enrichment';

import type { CatalogMetricsProps, EnrichedReportProps } from './report-types';

const percentage = (n: number) => `${n.toFixed(1)}%`;

export function GenreFingerprint({filter,dashboard,contributions}: Pick<CatalogMetricsProps,'filter'|'dashboard'|'contributions'>) {
  return <><div className="stack" data-metric="C"><section className="stack metrics-fingerprint"><h3>Genre fingerprint</h3><p className="meta">{filter.kind === 'all' ? 'Each contributor’s signature against the whole club.' : 'Distinctive genres compared with the whole club.'}</p>{filter.kind === 'all' ? contributions.map(row => <div className="metrics-signature" key={row.label}><strong>{row.label}</strong>{row.signature ? <ComparisonBars ratio={row.signature.ratio} label={row.signature.genre} value={`${row.signature.ratio.toFixed(1)}x club`} detail={`${row.signature.count} appearances · ${row.signature.percentage.toFixed(1)}%`} colour={row.signature.colour} /> : <span className="meta">No recognised genres</span>}</div>) : dashboard.fingerprint.length ? dashboard.fingerprint.map(g => <ComparisonBars ratio={g.ratio} key={g.genre} label={g.genre} value={`${g.ratio.toFixed(1)}x club`} detail={`${g.count} appearances · ${g.percentage.toFixed(1)}%`} colour={g.colour} />) : <p className="meta">No recognised genres for this selection.</p>}</section></div></>;
}

export function EnrichedFingerprints({isAll,themeReport,talentReport,signatures,role,setRole}: Pick<EnrichedReportProps,'isAll'|'themeReport'|'talentReport'|'signatures'|'role'|'setRole'>) {
  const comparison = (report:ReturnType<typeof fingerprint>) => {
    const outliers = report.values.filter(v => (v.ratio ?? 0) > 1).slice(0,12);
    return outliers.length ? <ul className="metrics-theme-cloud">{outliers.map((v,index) => <li key={v.id} style={{color:`var(--${metricsPalette[index % metricsPalette.length]})`,fontSize:`${1.25-index*0.025}em`}}><span>{v.label}</span><strong>{v.ratio!.toFixed(1)}x club</strong></li>)}</ul> : <p className="meta">No positive theme outliers for this selection.</p>;
  };
  return <div className="metrics-paired"><section className="stack metrics-themes" data-metric="F"><h3>Theme fingerprint</h3><p className="meta">Keywords across both sources · themes require three club appearances.</p>{isAll ? signatures.map(s => <div className="stack metrics-theme-signature" key={s.label}><strong>{s.label}</strong>{comparison(s.report)}</div>) : comparison(themeReport)}</section><section className="stack metrics-talent" data-metric="G"><h3>Talent fingerprint</h3><label className="stack">Role<select className="field__input" value={role} onChange={e => setRole(e.target.value as TalentRole)}>{talentRoles.map(r => <option key={r}>{r}</option>)}</select></label><p className="meta">Share of appearances with {role.toLowerCase()} evidence.{role === 'Director' && ' Exact director credits; shared credits stay together.'}</p>{talentReport.values.length ? <MetricsResults label="Talent" items={talentReport.values} render={v => <div className="metrics-talent-row" key={v.id}><span>{v.label}</span><p className="meta">{v.count} appearances · {percentage(v.percentage)}{!isAll && v.ratio !== null ? ` · ${v.ratio.toFixed(1)}x club` : ''}</p></div>} /> : <p className="meta">No qualifying evidence for this selection.</p>}</section></div>;
}
