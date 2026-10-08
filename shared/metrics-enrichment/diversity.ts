import { extremesCabinet, tiedExtreme, type Appearance } from '../metrics';
import { frequency, themeReader, metricsFactReader, metricsTalentReader, type Dimension, type MetricsEnrichment, type TalentRole } from './facts';

export function tasteDiversity(rows: Appearance[],data: MetricsEnrichment,dimension: Dimension) {
  const report = frequency(rows,dimension === 'themes' ? themeReader(data) : metricsFactReader(data,dimension));
  const distinct = report.values.filter(v => dimension !== 'cast' || v.count >= 2).length;
  return {distinct,covered:report.covered,total:rows.length,perTen:report.covered ? distinct/report.covered*10 : null};
}
export function recurringTalent(rows: Appearance[],data: MetricsEnrichment,role: TalentRole) {
  const report = frequency(rows,metricsTalentReader(data,role));
  return {covered:report.covered,extreme:tiedExtreme(report.values.filter(v => v.count >= 2),v => v.count)};
}
export const filmExtremes = extremesCabinet;
