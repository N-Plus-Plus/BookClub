import { formatCount } from '../../shared/format';
import { useMemo } from 'react';


import { MovieLink, Poster } from '../components';
import { runtimeLabel } from '../FilmIdentity';

import { MetricsResults } from '../MetricsResults';

import { talentRoles, recurringTalent, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import type { Appearance } from '../../shared/metrics';
import type { CatalogMetricsProps } from './report-types';

export function ExtremesMetrics({rows,dashboard,enrichment}: Pick<CatalogMetricsProps,'rows'|'dashboard'|'enrichment'>) {
  const countLabel = (value: number) => Number.isInteger(value) ? formatCount(value) : value.toLocaleString('en-AU');
  const extremes = dashboard.extremes;
  const filmCabinet = [
    {label:'Top critic',report:extremes.topCritic,value:extremes.topCritic ? `${extremes.topCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Top audience',report:extremes.topAudience,value:extremes.topAudience ? `${extremes.topAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom critic',report:extremes.bottomCritic,value:extremes.bottomCritic ? `${extremes.bottomCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom audience',report:extremes.bottomAudience,value:extremes.bottomAudience ? `${extremes.bottomAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Oldest',report:extremes.oldest,value:extremes.oldest?.value},
    {label:'Newest',report:extremes.newest,value:extremes.newest ? new Date(extremes.newest.value).toLocaleDateString('en-AU',{timeZone:'UTC'}) : null},
    {label:'Longest',report:extremes.longest,value:runtimeLabel(extremes.longest?.value ?? null)},
    {label:'Shortest',report:extremes.shortest,value:runtimeLabel(extremes.shortest?.value ?? null)},
    {label:'Most popular',report:extremes.mostPopular,value:extremes.mostPopular ? `${countLabel(extremes.mostPopular.value)} IMDb votes` : null},
    {label:'Most obscure',report:extremes.mostObscure,value:extremes.mostObscure ? `${countLabel(extremes.mostObscure.value)} IMDb votes` : null},
  ];
  return <><div className="stack" data-metric="X"><section className="stack metrics-section"><h2>Cabinet</h2><div className="metrics-extremes">{filmCabinet.map((item) => <section className="stack metrics-film-extreme" key={item.label}><h3>{item.label}</h3>{item.report ? <><strong>{item.report.items.length > 1 ? `${formatCount(item.report.items.length)}-way tie · ` : ''}{item.value}</strong>{<MetricsResults label={item.label} pageSize={item.report.items.length > 20 ? 5 : 20} items={item.report.items} render={row => <MovieLink key={row.movie.id} movie={row.movie} className="metrics-poster-film"><Poster movie={row.movie} large /><div><span className="movie-title">{row.movie.title}</span><p className="meta">{row.movie.year ?? 'Year unknown'}</p>{row.movie.director && <p className="meta">{row.movie.director}</p>}</div></MovieLink>} />}</> : <p className="meta">No data for this selection.</p>}</section>)}<CreatorExtremes rows={rows} data={enrichment.data} /></div></section></div></>;
}

export function CreatorExtremes({rows,data}: {rows:Appearance[];data:MetricsEnrichment}) {
  const reports = useMemo(() => talentRoles.filter(role => role !== 'Cast').map(role => ({role,...recurringTalent(rows,data,role)})),[rows,data]);
  return <>{reports.map((report) => <section className="stack metrics-creator-extreme" key={report.role}><h3>Most recurring <strong>{report.role.toLowerCase()}</strong></h3>{report.extreme ? <><p className="meta">{report.extreme.items.length > 1 ? `${formatCount(report.extreme.items.length)}-way tie · ` : ''}{formatCount(report.extreme.value)} appearances</p>{<MetricsResults label={report.role} items={report.extreme.items} render={item => <span key={item.id}>{item.label}</span>} />}</> : <p className="meta">No repeat {report.role.toLowerCase()} yet</p>}</section>)}</>;
}
