import { formatCount } from '../../shared/format';
import { Bar } from '../MetricsVisuals';

import type { EnrichedReportProps } from './report-types';

export function DiversityMetrics({diversity}: Pick<EnrichedReportProps,'diversity'>) {
  return <section className="stack metrics-section metrics-diversity"><div className="metrics-paired">{diversity.map(d => <section className="stack" data-metric={({countries:'O',languages:'P',themes:'Q',directors:'R',cast:'S'} as const)[d.dimension]} key={d.dimension}><h3>{({countries:'Production countries',languages:'Original languages',themes:'Themes',directors:'Directors',cast:'Recurring cast'} as const)[d.dimension]}</h3><p className="meta">{({countries:'How many different production countries appear per 10 films. Higher means a wider geographic spread.',languages:'How many different original languages appear per 10 films. Higher means a broader language mix.',themes:'How many distinct themes appear per 10 films. Higher means a broader range of themes.',directors:'How many different directors appear per 10 films. Higher means selections span more filmmakers.',cast:'How many cast members recur across at least two appearances, per 10 films.'} as const)[d.dimension]}</p>{d.values.map((v,index) => <Bar colour={index % 2 === 0 ? 'jeans' : 'lavender'} key={v.label} label={v.label} value={v.perTen === null ? 'No evidence' : `${v.perTen.toFixed(1)} per 10`} width={(v.perTen ?? 0)/Math.max(1,...d.values.map(other => other.perTen ?? 0))*100} detail={`${formatCount(v.distinct)} distinct`} />)}</section>)}</div></section>;
}
