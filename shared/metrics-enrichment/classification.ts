import type { MetricsEnrichmentMovie } from './facts';

export const auCategories = ['G','PG','M','MA15+','R18+','Other','Unknown'] as const;
export type AuCategory = typeof auCategories[number];
export function normaliseAu(value: string): AuCategory {
  const cleaned = value.trim().toUpperCase().replace(/\s/g,'');
  if (['G','PG','M'].includes(cleaned)) return cleaned as AuCategory;
  if (/^MA15\+?$/.test(cleaned)) return 'MA15+';
  if (/^R18\+?$/.test(cleaned)) return 'R18+';
  return 'Other';
}
/** Limited/wide theatrical (2/3) before all other release types. Highest familiar severity wins;
 * unusual evidence is Other, below familiar labels. Empty evidence is Unknown. */
export function australianClassification(movie: Pick<MetricsEnrichmentMovie,'contentRatings'>): AuCategory {
  const rows = movie.contentRatings.filter(r => r.certification.trim());
  if (!rows.length) return 'Unknown';
  const theatrical = rows.filter(r => r.release_type === 2 || r.release_type === 3);
  const severity: AuCategory[] = ['Other','G','PG','M','MA15+','R18+'];
  return (theatrical.length ? theatrical : rows).map(r => normaliseAu(r.certification)).sort((a,b) => severity.indexOf(b)-severity.indexOf(a))[0];
}
