import { formatCount } from '../../shared/format';
import { Bar } from '../MetricsVisuals';

import type { EnrichedReportProps } from './report-types';

const percentage = new Intl.NumberFormat('en-AU',{maximumFractionDigits:1});

export function DiversityMetrics({diversity}: Pick<EnrichedReportProps,'diversity'>) {
  return <div className="metrics-paired metrics-diversity">{diversity.map(d => <section className="stack" data-metric={({countries:'O',languages:'P',directors:'R',cast:'S'} as const)[d.dimension]} key={d.dimension}><h3>{({countries:'Production countries',languages:'Original languages',directors:'Directors',cast:'Recurring cast'} as const)[d.dimension]}</h3><p className="meta">{({countries:'Distinct production countries relative to appearances.',languages:'Distinct original languages relative to appearances.',directors:'Distinct directors relative to appearances.',cast:'Distinct recurring performers relative to appearances.'} as const)[d.dimension]}</p>{d.values.map((v,index) => <Bar colour={index % 2 === 0 ? 'jeans' : 'lavender'} key={v.label} label={v.label} value={v.perTen === null ? 'No evidence' : `${percentage.format(v.perTen*10)}%`} width={(v.perTen ?? 0)/Math.max(1,...d.values.map(other => other.perTen ?? 0))*100} detail={`${formatCount(v.distinct)} distinct`} />)}</section>)}</div>;
}
