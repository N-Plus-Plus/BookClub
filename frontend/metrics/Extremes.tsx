import { ReceptionRecords, ClassicsViewedRecords } from './ReceptionRecords';
import { Fragment } from 'react';
import type { Catalog, Movie } from '../../shared/types';
import { formatCount } from '../../shared/format';
import { useMemo } from 'react';


import { MovieLink, Poster } from '../components';
import { MetricsResults } from '../MetricsResults';

import { recurringTalent, type MetricsEnrichment } from '../../shared/metrics-enrichment';
import type { Appearance } from '../../shared/metrics';
import type { CatalogMetricsProps } from './report-types';

function recordRuntime(minutes:number | null) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} mins`;
  return [Math.floor(minutes/60) ? `${Math.floor(minutes/60)} hrs` : '', minutes%60 ? `${minutes%60} mins` : ''].filter(Boolean).join(', ');
}
function recordMetadata(movie: Movie, label:string) {
  if (label === 'Oldest' || label === 'Newest') return movie.release_date ?? String(movie.year ?? 'Year unknown');
  return [movie.year ?? 'Year unknown', ...(label === 'Longest' || label === 'Shortest' ? [recordRuntime(movie.runtime)] : [])].filter(Boolean).join(' · ');
}

export function ExtremesMetrics({catalog,rows,dashboard,enrichment}: Pick<CatalogMetricsProps,'rows'|'dashboard'|'enrichment'> & {catalog?:Catalog}) {
  const countLabel = (value: number) => Number.isInteger(value) ? formatCount(value) : value.toLocaleString('en-AU');
  const extremes = dashboard.extremes;
  const filmCabinet = [
    {label:'Top critic',report:extremes.topCritic,value:extremes.topCritic ? `${extremes.topCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Top audience',report:extremes.topAudience,value:extremes.topAudience ? `${extremes.topAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom critic',report:extremes.bottomCritic,value:extremes.bottomCritic ? `${extremes.bottomCritic.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Bottom audience',report:extremes.bottomAudience,value:extremes.bottomAudience ? `${extremes.bottomAudience.value.toFixed(1)} / 100` : 'No scores'},
    {label:'Most popular',report:extremes.mostPopular,value:extremes.mostPopular ? `${countLabel(extremes.mostPopular.value)} IMDb votes` : null},
    {label:'Most obscure',report:extremes.mostObscure,value:extremes.mostObscure ? `${countLabel(extremes.mostObscure.value)} IMDb votes` : null},
    {label:'Oldest',report:extremes.oldest,value:extremes.oldest?.value},
    {label:'Newest',report:extremes.newest,value:extremes.newest ? new Date(extremes.newest.value).toLocaleDateString('en-AU',{timeZone:'UTC'}) : null},
    {label:'Longest',report:extremes.longest,value:recordRuntime(extremes.longest?.value ?? null)},
    {label:'Shortest',report:extremes.shortest,value:recordRuntime(extremes.shortest?.value ?? null)},
  ];
  return <><div className="stack" data-metric="X"><section className="stack metrics-section"><h2>Records</h2><div className="metrics-extremes">{filmCabinet.map((item,index) => <Fragment key={item.label}><section className="stack metrics-film-extreme" key={item.label}><h3>{item.label}</h3>{item.report ? <>{!['Oldest','Newest','Longest','Shortest'].includes(item.label) && <strong>{item.report.items.length > 1 ? `${formatCount(item.report.items.length)}-way tie · ` : ''}{item.value}</strong>}{['Oldest','Newest','Longest','Shortest'].includes(item.label) && item.report.items.length > 1 && <p className="meta">{formatCount(item.report.items.length)}-way tie</p>}{<MetricsResults label={item.label} pageSize={item.report.items.length > 20 ? 5 : 20} items={item.report.items} render={row => <MovieLink key={row.movie.id} movie={row.movie} className="metrics-poster-film"><Poster movie={row.movie} large /><div><span className="movie-title">{row.movie.title}</span><p className="meta">{recordMetadata(row.movie,item.label)}</p>{row.movie.director && <p className="meta">{row.movie.director}</p>}</div></MovieLink>} />}</> : <p className="meta">No data for this selection.</p>}</section>{index===3&&<ReceptionRecords rows={rows}/>}{index===5&&catalog&&<ClassicsViewedRecords catalog={catalog}/>}</Fragment>)}<CreatorExtremes rows={rows} data={enrichment.data} /></div></section></div></>;
}

export function CreatorExtremes({rows,data}: {rows:Appearance[];data:MetricsEnrichment}) {
  const reports = useMemo(() => (['Director','Writer','Composer','Cinematographer','Editor','Producer'] as const).map(role => ({role,...recurringTalent(rows,data,role)})),[rows,data]);
  return <>{reports.map((report) => <section className="stack metrics-creator-extreme" key={report.role}><h3>Most recurring <strong>{report.role.toLowerCase()}</strong></h3>{report.extreme ? <><p className="meta">{report.extreme.items.length > 1 ? `${formatCount(report.extreme.items.length)}-way tie · ` : ''}{formatCount(report.extreme.value)} appearances</p><div className="metrics-creator-winners"><MetricsResults label={report.role} items={report.extreme.items} render={item => <div key={item.id}>{item.label}</div>} /></div></> : <p className="meta">No repeat {report.role.toLowerCase()} yet</p>}</section>)}</>;
}
