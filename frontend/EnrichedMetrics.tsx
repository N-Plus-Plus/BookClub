export { useMetricsEnrichment } from './useMetricsEnrichment';
export { CreatorExtremes } from './metrics/Extremes';
import { EnrichedFingerprints } from './metrics/Fingerprints';
import { ClassificationChart } from './metrics/Profiles';
import { MedianEconomics, RatingsProfile } from './metrics/General';
import { DiversityMetrics } from './metrics/Diversity';
import { TopFiveEnrichment } from './metrics/TopBottom';
import { RefreshCw } from 'lucide-react';
import { Action } from './components';
import { useState } from 'react';
import type { Catalog } from '../shared/types';
import { type Appearance, type MetricsFilter, type metricsDashboard } from '../shared/metrics';
import { comparisonScopes, contributorScopes, filterContributorScopes, medianEconomicsComparison, topFrequency, themeFingerprint, tasteDiversity, type MetricsEnrichment, type TalentRole, metricsTalentReader } from '../shared/metrics-enrichment';

import type { MetricsTab } from './metrics-tabs';
import { useMetricsReports } from './metrics-cache';

export function EnrichedMetrics({category,catalog,all,rows,filter,data,status,retry,dashboard}: {category:MetricsTab;catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;status:string;retry:()=>void;dashboard:ReturnType<typeof metricsDashboard>}) {
  const [role,setRole] = useState<TalentRole>('Cast');
  const cached=useMetricsReports([catalog,all,rows,filter,data]);
  const scopes = category==='fingerprints'?cached('scopes',()=>comparisonScopes(catalog,all,filter)):[];
  const isAll = filter.kind === 'all';
  const emptyReport={covered:0,distinct:0,values:[]};
  const themeReport = category === 'fingerprints' && !isAll ? cached('themes',()=>themeFingerprint(rows,all,data)) : emptyReport;
  const signatures = category === 'fingerprints' && isAll ? cached('signatures',()=>scopes.map(s=>({...s,report:themeFingerprint(s.rows,all,data)}))) : [];
  const talentReport = category === 'top-bottom' ? cached(`talent:${role}`,()=>{
    return topFrequency(rows,all,metricsTalentReader(data,role),true);
  }) : emptyReport;
  const populationCache=useMetricsReports([catalog,all,data]);
  const population=category==='general'?populationCache('contributors',()=>contributorScopes(catalog,all)):[];
  const contributors=category==='general'?cached('selectedContributors',()=>filterContributorScopes(population,filter)):[];
  const economics=category==='general'?populationCache('medianComparison',()=>medianEconomicsComparison(population,data)):{groups:[],maximum:0};
  const diversity = category === 'fingerprints' ? cached('diversity',()=>(['countries','languages','directors','cast'] as const).map(dimension=>({dimension,values:scopes.map(s=>({label:s.label,...tasteDiversity(s.rows,data,dimension)}))}))) : [];

  return <>{status !== 'ready' && <div role="status" className="stack"><p className="meta">{status === 'loading' ? 'Loading enriched Metrics…' : 'Enriched Metrics could not load. Existing Metrics remains available.'}</p>{status === 'error' && <Action icon={RefreshCw} onClick={retry}>Retry enriched Metrics</Action>}</div>}
    {category === 'fingerprints' && <EnrichedFingerprints isAll={isAll} themeReport={themeReport} signatures={signatures} />}
    {category === 'general' && <><ClassificationChart data={data} scopes={contributors} /><MedianEconomics economics={filterContributorScopes(economics.groups,filter)} maximum={economics.maximum} /><RatingsProfile dashboard={dashboard} /></>}
    {category === 'fingerprints' && <DiversityMetrics diversity={diversity} />}
    {category === 'top-bottom' && <TopFiveEnrichment rows={rows} all={all} data={data} isAll={isAll} cached={cached} talentReport={talentReport} role={role} setRole={setRole} />}
  </>;
}
