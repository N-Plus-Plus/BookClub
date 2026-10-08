import type { Catalog } from '../../../shared/types';
import type { Appearance, MetricsFilter } from '../../../shared/metrics';
import type { MetricsEnrichment } from '../../../shared/metrics-enrichment';
import { genreCombinations, genreOverlap, firstSharedTheme } from '../../../shared/metrics-staging/overlap';
import { useStagingReports } from './cache';
import { Report, Empty, Matrix, number } from './primitives';
import { formatCount } from '../../../shared/format';
import { MetricsResults } from '../../MetricsResults';
export function OverlapReports({catalog,all,rows,filter,data,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;reportCache?:Map<string,unknown>}) {
  const cached=useStagingReports([catalog,all,rows,data],reportCache,'overlap');
  const combinations=cached('combinations',()=>genreCombinations(rows)),genres=cached('genres',()=>genreOverlap(catalog,all)),themes=cached('themes',()=>firstSharedTheme(catalog,all,data));
  return <><Report title="Top 5 genre combinations" note="All unique genre subsets of two or more genres. Counts distinct canonical History films; includes every fifth-place tie.">{combinations.length?<ol className="staging-ranking"><MetricsResults label="Genre combinations" list items={combinations} render={v=><li key={v.label}><span>{v.label}</span><strong>{formatCount(v.count)} films</strong></li>}/></ol>:<Empty/>}</Report>
    <Report title="Genre taste overlap" note="Cosine similarity of genre frequency distributions, 0–100%. Each appearance shares one unit equally among its recognised genres. No usable evidence is unavailable. Filtering emphasises a contributor while retaining comparison references."><Matrix catalog={catalog} scopes={genres.scopes} filter={filter} label="Genre taste overlap" cell={(a,b)=>{const value=genres.values[a][b];return {text:value===null?'Unavailable':`${number(value)}%`,detail:value===null?'No usable genre evidence':`${number(value)}% cosine similarity${a===b?'; self comparison':''}`,strength:value??undefined};}}/></Report>
    <Report title="First shared theme" note="First shared cleaned keyword: minimise the larger of the two frequency ranks, then their sum, displayed name and identity. Frequencies count film appearances; cells show an intersection, not similarity."><Matrix catalog={catalog} scopes={themes.scopes} filter={filter} label="First shared theme" cell={(a,b)=>{const value=themes.values[a][b];return a===b?{text:'Self',detail:'Self comparison; no pairwise intersection'}:value?{text:value.label,detail:`${value.label}; ${themes.scopes[a].label} rank ${value.rankA}, ${value.countA} appearances; ${themes.scopes[b].label} rank ${value.rankB}, ${value.countB} appearances`}:{text:'None shared',detail:'No shared eligible keyword evidence'};}}/></Report></>;
}
