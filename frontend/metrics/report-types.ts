import type { Catalog } from '../../shared/types';
import type { Appearance, MetricsFilter, MetricsScoreDimension, RankedAppearance, metricsDashboard, calculateMetrics, contributorMetrics } from '../../shared/metrics';
import type { comparisonScopes, filmEconomics, fingerprint, tasteDiversity, Dimension, MetricsEnrichment, TalentRole, metricsFactReader } from '../../shared/metrics-enrichment';
import type { useMetricsReports } from '../metrics-cache';
export interface CatalogMetricsProps {
  catalog:Catalog; rows:Appearance[]; filter:MetricsFilter;
  dashboard:ReturnType<typeof metricsDashboard>; metrics:ReturnType<typeof calculateMetrics>; contributions:ReturnType<typeof contributorMetrics>;
  topDimension:MetricsScoreDimension; bottomDimension:MetricsScoreDimension;
  setTopDimension:(id:MetricsScoreDimension)=>void; setBottomDimension:(id:MetricsScoreDimension)=>void;
  topRows:RankedAppearance[]; bottomRows:RankedAppearance[];
  enrichment:{data:MetricsEnrichment};
}
export interface EnrichedReportProps {
  rows:Appearance[]; all:Appearance[]; data:MetricsEnrichment; isAll:boolean;
  scopes:ReturnType<typeof comparisonScopes>; cached:ReturnType<typeof useMetricsReports>;
  reader:(dimension:Dimension)=>ReturnType<typeof metricsFactReader>;
  themeReport:ReturnType<typeof fingerprint>; talentReport:ReturnType<typeof fingerprint>;
  signatures:(ReturnType<typeof comparisonScopes>[number] & {report:ReturnType<typeof fingerprint>})[];
  role:TalentRole; setRole:(role:TalentRole)=>void;
  language:{id:string;label:string}[];
  economics:(ReturnType<typeof comparisonScopes>[number] & {report:ReturnType<typeof filmEconomics>})[];
  diversity:{dimension:'countries'|'languages'|'themes'|'directors'|'cast';values:({label:string}&ReturnType<typeof tasteDiversity>)[]}[];
}
