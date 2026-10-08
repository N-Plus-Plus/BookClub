export { useMetricsEnrichment } from './useMetricsEnrichment';
export { CreatorExtremes } from './metrics/Extremes';
import { EnrichedFingerprints } from './metrics/Fingerprints';
import { EnrichedProfiles } from './metrics/Standalone';
import { MedianEconomics } from './metrics/Averages';
import { DiversityMetrics } from './metrics/Diversity';
import { GeneralEconomics } from './metrics/General';
import { RefreshCw } from 'lucide-react';
import { Action } from './components';
import { useState } from 'react';
import type { Catalog } from '../shared/types';
import { withCutoffTies, type Appearance, type MetricsFilter } from '../shared/metrics';
import { comparisonScopes, filmEconomics, fingerprint, themeFingerprint, languageCategories, tasteDiversity, type Dimension, type MetricsEnrichment, type TalentRole, metricsFactReader, metricsTalentReader } from '../shared/metrics-enrichment';

import type { MetricsTab } from './metrics-tabs';
import { useMetricsReports } from './metrics-cache';

export function EnrichedMetrics({category,catalog,all,rows,filter,data,status,retry}: {category:MetricsTab;catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;status:string;retry:()=>void}) {
  const [role,setRole] = useState<TalentRole>('Cast');
  const cached=useMetricsReports([catalog,all,rows,filter,data]);
  const scopes = cached('scopes',()=>comparisonScopes(catalog,all,filter));
  const isAll = filter.kind === 'all';
  const reader = (dimension:Dimension) => metricsFactReader(data,dimension);
  const emptyReport={covered:0,distinct:0,values:[]};
  const themeReport = category === 'fingerprints' && !isAll ? cached('themes',()=>themeFingerprint(rows,all,data,{distinctive:true,limit:Number.MAX_SAFE_INTEGER})) : emptyReport;
  const signatures = category === 'fingerprints' && isAll ? cached('signatures',()=>scopes.map(s=>({...s,report:themeFingerprint(s.rows,all,data,{distinctive:true,limit:Number.MAX_SAFE_INTEGER})}))) : [];
  const talentReport = category === 'fingerprints' ? cached(`talent:${role}`,()=>{
    const report=fingerprint(rows,all,metricsTalentReader(data,role),{qualifyingShare:true,limit:role === 'Cast' ? Number.MAX_SAFE_INTEGER : 10});
    return role === 'Cast' ? {...report,values:withCutoffTies(report.values,v=>v.count)} : report;
  }) : emptyReport;
  const language = category === 'standalone' ? cached('language',()=>languageCategories(all,data)) : [];
  const economics = category === 'averages' ? cached('economics',()=>scopes.map(s=>({...s,report:filmEconomics(s.rows,data)}))) : [];
  const diversity = category === 'diversity' ? cached('diversity',()=>(['countries','languages','themes','directors','cast'] as const).map(dimension=>({dimension,values:scopes.map(s=>({label:s.label,...tasteDiversity(s.rows,data,dimension)}))}))) : [];

  return <>{['fingerprints','general','averages','diversity','standalone','extremes'].includes(category) && status !== 'ready' && <div role="status" className="stack"><p className="meta">{status === 'loading' ? 'Loading enriched Metrics…' : 'Enriched Metrics could not load. Existing Metrics remains available.'}</p>{status === 'error' && <Action icon={RefreshCw} onClick={retry}>Retry enriched Metrics</Action>}</div>}
    {category === 'fingerprints' && <EnrichedFingerprints isAll={isAll} themeReport={themeReport} talentReport={talentReport} signatures={signatures} role={role} setRole={setRole} />}
    {['fingerprints','standalone','general'].includes(category) && <EnrichedProfiles rows={rows} all={all} data={data} isAll={isAll} scopes={scopes} cached={cached} reader={reader} language={language} category={category} />}
    {category === 'averages' && <MedianEconomics economics={economics} />}
    {category === 'diversity' && <DiversityMetrics diversity={diversity} />}
    {category === 'general' && <GeneralEconomics rows={rows} data={data} cached={cached} />}
  </>;
}
