import { useMemo, type CSSProperties } from 'react';

import { metricsPalette } from '../../shared/metrics';

import { MovieLink, Poster } from '../components';
import { runtimeLabel } from '../FilmIdentity';

import { MetricsResults } from '../MetricsResults';

import { talentRoles, recurringTalent, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import type { Appearance } from '../../shared/metrics';
import type { CatalogMetricsProps } from './report-types';

export function ExtremesMetrics({rows,dashboard,enrichment}: Pick<CatalogMetricsProps,'rows'|'dashboard'|'enrichment'>) {
  const countLabel = (value: number) => value.toLocaleString('en-AU');
  const extremes = dashboard.extremes;
  const filmCabinet = [
    {label:'Top Critic',report:extremes.topCritic,value:extremes.topCritic ? `${extremes.topCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Top Audience',report:extremes.topAudience,value:extremes.topAudience ? `${extremes.topAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom Critic',report:extremes.bottomCritic,value:extremes.bottomCritic ? `${extremes.bottomCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom Audience',report:extremes.bottomAudience,value:extremes.bottomAudience ? `${extremes.bottomAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Oldest',report:extremes.oldest,value:extremes.oldest?.value},
    {label:'Longest',report:extremes.longest,value:runtimeLabel(extremes.longest?.value ?? null)},
    {label:'Most Popular',report:extremes.mostPopular,value:extremes.mostPopular ? `${countLabel(extremes.mostPopular.value)} IMDb votes` : null},
    {label:'Most Obscure',report:extremes.mostObscure,value:extremes.mostObscure ? `${countLabel(extremes.mostObscure.value)} IMDb votes` : null},
  ];
  return <><div className="stack" data-metric="X"><section className="stack metrics-section"><h2>Extremes cabinet</h2><div className="metrics-extremes">{filmCabinet.map((item,index) => <section className="stack metrics-film-extreme" key={item.label}><h3 style={{'--extreme-colour':`var(--${metricsPalette[index]})`} as CSSProperties}>{item.label}</h3>{item.report ? <><strong>{item.report.items.length > 1 ? `${item.report.items.length}-way tie · ` : ''}{item.value}</strong>{<MetricsResults label={item.label} pageSize={item.report.items.length > 20 ? 5 : 20} items={item.report.items} render={row => <MovieLink key={row.movie.id} movie={row.movie} className="metrics-poster-film"><Poster movie={row.movie} large /><div><span className="movie-title">{row.movie.title}</span><p className="meta">{row.movie.year ?? 'Year unknown'}</p></div></MovieLink>} />}</> : <p className="meta">No data for this selection.</p>}</section>)}<CreatorExtremes rows={rows} data={enrichment.data} colourOffset={filmCabinet.length} /></div></section></div></>;
}

export function CreatorExtremes({rows,data,colourOffset}: {rows:Appearance[];data:MetricsEnrichment;colourOffset:number}) {
  const reports = useMemo(() => talentRoles.filter(role => role !== 'Cast').map(role => ({role,...recurringTalent(rows,data,role)})),[rows,data]);
  return <>{reports.map((report,index) => <section className="stack metrics-creator-extreme" key={report.role}><h3 style={{'--extreme-colour':`var(--${metricsPalette[(index+colourOffset)%metricsPalette.length]})`} as CSSProperties}>Most recurring {report.role}</h3>{report.extreme ? <><p className="meta">{report.extreme.items.length > 1 ? `${report.extreme.items.length}-way tie · ` : ''}{report.extreme.value} appearances</p>{<MetricsResults label={report.role} items={report.extreme.items} render={item => <span key={item.id}>{item.label}</span>} />}</> : <p className="meta">No repeat {report.role.toLowerCase()} yet</p>}</section>)}</>;
}
