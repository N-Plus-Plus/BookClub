import type { Catalog } from '../../../shared/types';
import type { Appearance, MetricsFilter } from '../../../shared/metrics';
import type { MetricsEnrichment } from '../../../shared/metrics-enrichment';
import { genreOverlap, firstSharedTheme } from '../../../shared/metrics-staging/overlap';
import { useStagingReports } from './cache';
import { Report, Matrix, number } from './primitives';
export function OverlapReports({catalog,all,rows,filter,data,reportCache}:{catalog:Catalog;all:Appearance[];rows:Appearance[];filter:MetricsFilter;data:MetricsEnrichment;reportCache?:Map<string,unknown>}) {
  const cached=useStagingReports([catalog,all,rows,data],reportCache,'overlap');
  const genres=cached('genres',()=>genreOverlap(catalog,all)),themes=cached('themes',()=>firstSharedTheme(catalog,all,data));
  return <>
    <Report title="Genre taste overlap" note="How closely each pair’s genre tastes align."><Matrix catalog={catalog} scopes={genres.scopes} filter={filter} label="Genre taste overlap" cell={(a,b)=>{const value=genres.values[a][b];return {text:value===null?'Unavailable':`${number(value)}%`,detail:value===null?'No usable genre evidence':`${number(value)}% cosine similarity${a===b?'; self comparison':''}`,colour:genres.colours[a][b]??undefined};}}/></Report>
    <Report title="First shared theme" note="Unique shared themes for each contributor pair."><Matrix catalog={catalog} scopes={themes.scopes} filter={filter} label="First shared theme" cell={(a,b)=>{const value=themes.values[a][b];return a===b?{text:'Self',detail:'Self comparison; no pairwise intersection'}:value?{text:value.label,detail:`${value.label}; ${themes.scopes[a].label} rank ${value.rankA}, ${value.countA} appearances; ${themes.scopes[b].label} rank ${value.rankB}, ${value.countB} appearances`}:{text:'No unique theme',detail:'No unique shared theme remains'};}}/></Report></>;
}
