import type { Catalog } from '../../shared/types';
import type { Appearance, MetricsFilter, MetricsScoreCategory, RankedAppearance, metricsDashboard, calculateMetrics, contributorMetrics } from '../../shared/metrics';
import type { comparisonScopes, fingerprint, tasteDiversity, MetricsEnrichment, TalentRole } from '../../shared/metrics-enrichment';
import type { useMetricsReports } from '../metrics-cache';
export interface CatalogMetricsProps {
  catalog:Catalog; rows:Appearance[]; filter:MetricsFilter;
  dashboard:ReturnType<typeof metricsDashboard>; metrics:ReturnType<typeof calculateMetrics>; contributions:ReturnType<typeof contributorMetrics>;
  topDimension:MetricsScoreCategory; bottomDimension:MetricsScoreCategory;
  setTopDimension:(id:MetricsScoreCategory)=>void; setBottomDimension:(id:MetricsScoreCategory)=>void;
  topRows:RankedAppearance[]; bottomRows:RankedAppearance[];
  enrichment:{data:MetricsEnrichment};
}
export interface EnrichedReportProps {
  rows:Appearance[]; all:Appearance[]; data:MetricsEnrichment; isAll:boolean;
  scopes:ReturnType<typeof comparisonScopes>; cached:ReturnType<typeof useMetricsReports>;
  themeReport:ReturnType<typeof fingerprint>; talentReport:ReturnType<typeof fingerprint>;
  signatures:(ReturnType<typeof comparisonScopes>[number] & {report:ReturnType<typeof fingerprint>})[];
  role:TalentRole; setRole:(role:TalentRole)=>void;
  diversity:{dimension:'countries'|'languages'|'directors'|'cast';values:({label:string}&ReturnType<typeof tasteDiversity>)[]}[];
}
