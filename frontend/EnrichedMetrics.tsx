export { useMetricsEnrichment } from './useMetricsEnrichment';
export { CreatorExtremes } from './metrics/Extremes';
import { GenreFingerprint, EnrichedFingerprints } from './metrics/Fingerprints';
import { ClassificationChart } from './metrics/Profiles';
import { ContributionReport, GenreDetailReport, ReleaseDecadesReport, MedianEconomics, RatingsProfile } from './metrics/General';
import { DiversityMetrics } from './metrics/Diversity';
import { TopFiveEnrichment } from './metrics/TopBottom';
import { RefreshCw } from 'lucide-react';
import { Action } from './components';
import { useState } from 'react';
import { CycleReport, SpreadReports, LeaningReport } from './metrics/staging/Core';
import { OverlapReport } from './metrics/staging/Overlap';
import { SharedStarsReport, PartnershipsReport, GenreRevenueReport, FlopsReport, ClassificationAcclaimReport, PlatformsReport, CollectionReports, AwardsReport } from './metrics/staging/Evidence';
import type { CatalogMetricsProps } from './metrics/report-types';
import type { Catalog } from '../shared/types';
import { type Appearance, type MetricsFilter, type metricsDashboard } from '../shared/metrics';
import { comparisonScopes, contributorScopes, filterContributorScopes, medianEconomicsComparison, topFrequency, themeFingerprint, tasteDiversity, type MetricsEnrichment, type TalentRole, metricsTalentReader, metricsFactReader } from '../shared/metrics-enrichment';

import type { MetricsTab } from './metrics-tabs';
import { useMetricsReports } from './metrics-cache';

export function EnrichedMetrics({category,catalog,all,rows,filter,data,status,retry,dashboard,metrics,contributions}: {category:MetricsTab;catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;status:string;retry:()=>void;dashboard:ReturnType<typeof metricsDashboard>;metrics:CatalogMetricsProps["metrics"];contributions:CatalogMetricsProps["contributions"]}) {
  const [role,setRole] = useState<TalentRole|'Studios'>('Cast');
  const cached=useMetricsReports([catalog,all,rows,filter,data]);
  const scopes = category==='fingerprints'?cached('scopes',()=>comparisonScopes(catalog,all,filter)):[];
  const reportCache=cached('additionalReports',()=>new Map<string,unknown>());
  const reportProps={catalog,all,rows,filter,data,reportCache};
  const isAll = filter.kind === 'all';
  const emptyReport={covered:0,distinct:0,values:[]};
  const themeReport = category === 'fingerprints' && !isAll ? cached('themes',()=>themeFingerprint(rows,all,data)) : emptyReport;
  const signatures = category === 'fingerprints' && isAll ? cached('signatures',()=>scopes.map(s=>({...s,report:themeFingerprint(s.rows,all,data)}))) : [];
  const talentReport = category === 'top-bottom' ? cached(`talent:${role}`,()=>{
    return role === 'Studios' ? topFrequency(rows,all,metricsFactReader(data,'companies')) : topFrequency(rows,all,metricsTalentReader(data,role),true);
  }) : emptyReport;
  const populationCache=useMetricsReports([catalog,all,data]);
  const population=category==='general'?populationCache('contributors',()=>contributorScopes(catalog,all)):[];
  const contributors=category==='general'?cached('selectedContributors',()=>filterContributorScopes(population,filter)):[];
  const economics=category==='general'?populationCache('medianComparison',()=>medianEconomicsComparison(population,data)):{groups:[],maximum:0};
  const diversity = category === 'fingerprints' ? cached('diversity',()=>(['cast','directors','languages','countries'] as const).map(dimension=>({dimension,values:scopes.map(s=>({label:s.label,...tasteDiversity(s.rows,data,dimension)}))}))) : [];

  return <>{status !== 'ready' && <div role="status" className="stack"><p className="meta">{status === 'loading' ? 'Loading enriched Metrics…' : 'Enriched Metrics could not load. Existing Metrics remains available.'}</p>{status === 'error' && <Action icon={RefreshCw} onClick={retry}>Retry enriched Metrics</Action>}</div>}
    {category === 'fingerprints' && <>
      <GenreFingerprint filter={filter} dashboard={dashboard} contributions={contributions}/>
      <OverlapReport {...reportProps} kind="genres"/>
      <EnrichedFingerprints isAll={isAll} themeReport={themeReport} signatures={signatures}/>
      <OverlapReport {...reportProps} kind="themes"/>
      <SharedStarsReport {...reportProps}/>
      <DiversityMetrics diversity={diversity}/>
    </>}
    {category === 'general' && <>
      <ContributionReport contributions={contributions}/>
      <CycleReport {...reportProps}/><CollectionReports {...reportProps}/><LeaningReport {...reportProps}/>
      <RatingsProfile dashboard={dashboard}/><AwardsReport {...reportProps}/><ClassificationAcclaimReport {...reportProps}/>
      <ClassificationChart data={data} scopes={contributors}/>
      <GenreDetailReport metrics={metrics}/>
      <ReleaseDecadesReport dashboard={dashboard}/>
      <SpreadReports {...reportProps}/>
      <MedianEconomics catalog={catalog} economics={filterContributorScopes(economics.groups,filter)} maximum={economics.maximum}/>
      <GenreRevenueReport {...reportProps}/><FlopsReport {...reportProps}/><PlatformsReport {...reportProps}/>
    </>}
    {category === 'top-bottom' && <TopFiveEnrichment rows={rows} data={data} isAll={isAll} cached={cached} talentReport={talentReport} role={role} setRole={setRole} partnerships={<PartnershipsReport {...reportProps}/>} />}
  </>;
}
