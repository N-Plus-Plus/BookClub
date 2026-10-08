import { formatCount } from '../../shared/format';
import { metricsScoreDimensions, type MetricsScoreDimension, type RankedAppearance, type PopularAppearance } from '../../shared/metrics';
import { sourceRatingKeys, ratingDimensions } from '../../shared/rating-dimensions';
import { catalogIndex } from '../../shared/catalog-index';

import { dateLabel, MovieLink, Poster } from '../components';

import { formatScore100 } from '../presentation';
import { ClubIdentity } from '../ClubIdentity';
import { MetricsResults } from '../MetricsResults';

import type { CatalogMetricsProps } from './report-types';

// Sentence-case report descriptors; canonical source names and selector labels stay intact.
const sourceHeadings: Partial<Record<MetricsScoreDimension,string>> = {
  'metacritic-user':'Metacritic user',
  'rt-audience':'Rotten Tomatoes - audience',
  'rt-critic':'Rotten Tomatoes - critic',
};
const scoreSelectorDimensions = sourceRatingKeys.map(key => metricsScoreDimensions.find(d => d.id === ratingDimensions[key].id)!);

export function TopBottomMetrics({catalog,dashboard,topDimension,bottomDimension,setTopDimension,setBottomDimension,topRows,bottomRows}: Pick<CatalogMetricsProps,'catalog'|'rows'|'dashboard'|'topDimension'|'bottomDimension'|'setTopDimension'|'setBottomDimension'|'topRows'|'bottomRows'>) {
  const countLabel = (value: number) => Number.isInteger(value) ? formatCount(value) : value.toLocaleString('en-AU');
  const popularityList = (title: string,items: PopularAppearance[]) => <section className="stack"><h3>{title}</h3>{items.length ? <ol className="metrics-popularity-list">{items.map(row => <li key={row.movie.id}><MovieLink movie={row.movie} className="metrics-poster-film"><Poster movie={row.movie} /><div><span className="movie-title">{row.movie.title}</span><p className="meta">{row.movie.year ?? 'Year unknown'}</p><strong>{countLabel(row.votes)} IMDb votes</strong></div></MovieLink></li>)}</ol> : <p className="meta">No IMDb vote data for this selection.</p>}</section>;
  const list = (direction: 'Top' | 'Bottom',id: MetricsScoreDimension,setDimension: (id: MetricsScoreDimension) => void,rows: RankedAppearance[]) => {
    const dimension = metricsScoreDimensions.find(d => d.id === id)!;
    return <section className="stack" data-metric={direction === 'Top' ? 'U' : 'V'}><h2>{direction} 5 by {sourceHeadings[id] ?? dimension.name}</h2><div className="metrics-score-filters" role="group" aria-label={`${direction} 5 score filter`}>{scoreSelectorDimensions.map(d => <button className="tab-control" type="button" key={d.id} aria-label={d.name} aria-pressed={id === d.id} onClick={() => setDimension(d.id)}>{d.label}</button>)}</div>{!rows.length ? <p className="meta">No appearances with {dimension.name} scores yet.</p> : <ol className="metrics-list">{rows.map(row => {
    const host = catalogIndex(catalog).memberById.get(row.session.host_member_id ?? '');
    const cycle = catalogIndex(catalog).cycleById.get(row.session.cycle_id ?? '');
    return <li key={`${row.session.id}:${row.position}`}><MovieLink movie={row.movie} className="metrics-film-item"><div className="stack"><span className="movie-title">{row.movie.title}</span></div><div className="metrics-film-footer"><div className="stack"><strong>{dimension.scale === 100 ? formatScore100(row.selectedScore) : dimension.scale === 10 ? row.selectedScore.toFixed(1) : String(Number(row.selectedScore.toFixed(2)))} / {dimension.scale}</strong><p className="meta">{row.movie.year ? `${row.movie.year} · ` : 'Year unknown · '}{row.session.date_precision === 'exact' && !cycle?.import_source && !cycle?.import_key ? `${dateLabel(row.session.event_date)} · ` : ''}{cycle ? `Cycle ${cycle.ordinal} ` : ''}Film {row.position}</p></div><div className="metrics-film-host">{row.session.kind === 'classics' ? <ClubIdentity identity={{kind: 'classics'}} /> : host ? <ClubIdentity identity={{kind: 'member',member: host}} /> : <span className="meta">Host unknown</span>}</div></div></MovieLink></li>;
  })}</ol>}</section>;
  };
  return <><div className="stack" data-metric="E"><section className="stack metrics-directors"><h3>Top directors</h3>{dashboard.directors.top.length ? <MetricsResults label="Top directors" items={dashboard.directors.top} render={d => <div className="metrics-distribution-label" key={d.name}><span>{d.name}</span><span className="meta">{formatCount(d.count)} appearances · {d.percentage.toFixed(1)}%</span></div>} /> : <p className="meta">No director data for this selection.</p>}</section></div><div className="metrics-rankings">{list('Top',topDimension,setTopDimension,topRows)}{list('Bottom',bottomDimension,setBottomDimension,bottomRows)}</div><div className="stack" data-metric="W"><section className="stack metrics-section"><h2>Popularity &amp; obscurity</h2><p className="meta">{dashboard.popularity.median === null ? 'No IMDb vote data for this selection.' : `Median ${countLabel(dashboard.popularity.median)} IMDb votes`} · Lists show unique films.</p><div className="metrics-paired">{popularityList('Most popular',dashboard.popularity.popular)}{popularityList('Most obscure',dashboard.popularity.obscure)}</div></section></div></>;
}
