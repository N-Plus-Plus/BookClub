import { formatCount } from '../../shared/format';
import { Bar, Coverage } from '../MetricsVisuals';

import { MetricsResults } from '../MetricsResults';
import { Stacks } from './Profiles';
import { auCategories, fingerprint } from '../../shared/metrics-enrichment';

import type { EnrichedReportProps } from './report-types';
import type { MetricsTab } from '../metrics-tabs';
const percentage = (n: number) => `${n.toFixed(1)}%`;

export function EnrichedProfiles({rows,all,data,isAll,scopes,cached,reader,language,category}: Pick<EnrichedReportProps,'rows'|'all'|'data'|'isAll'|'scopes'|'cached'|'reader'|'language'> & {category:MetricsTab}) {
const bars = (report:ReturnType<typeof fingerprint>,ratios:boolean) => report.values.length ? <MetricsResults label="Distribution" items={report.values} render={v => <Bar key={v.id} label={v.label} value={`${formatCount(v.count)} · ${percentage(v.percentage)}`} detail={ratios && v.ratio !== null ? `${v.ratio.toFixed(1)}x club` : 'Appearance count and share'} width={v.percentage} colour={v.colour} />} /> : <p className="meta">No qualifying evidence for this selection.</p>;
  return <div className="metrics-paired">{(['countries','companies'] as const).filter(d => d === 'countries' ? category === 'standalone' : category === 'fingerprints').map(d => {
      const report = cached(d,()=>fingerprint(rows,all,reader(d),{distinctive:!isAll && d === 'countries',minimum:!isAll && d === 'companies' ? 2 : 1,limit:d === 'companies' ? 20 : Number.MAX_SAFE_INTEGER}));
      return <section className={`stack metrics-${d}`} data-metric={d === 'countries' ? 'H' : 'J'} key={d}><h3>{d === 'countries' ? 'Production countries' : 'Studio fingerprint'}</h3>{d === 'companies' && <Coverage label="Production company" covered={report.covered} total={rows.length} />}{d === 'countries' && <p className="meta">{formatCount(report.distinct)} distinct production countries.</p>}<p className="meta">A film may have several {d === 'countries' ? 'production countries' : 'production companies'}; totals can exceed appearances.</p>{<div className="stack metrics-five-scroll" tabIndex={0} role="region" aria-label={d === 'countries' ? 'Production countries' : 'Studio fingerprint'}>{bars(report,!isAll)}</div>}</section>;
    })}{category === 'standalone' && <section className="stack metrics-languages" data-metric="I"><h3>Original-language profile</h3><Stacks scopes={scopes} data={data} dimension="language" categories={language} /></section>}{category === 'general' && <section className="stack metrics-classifications" data-metric="K"><h3>Australian classification</h3><Stacks scopes={scopes} data={data} dimension="classification" categories={auCategories.map(id => ({id,label:id}))} /></section>}</div>;
}
