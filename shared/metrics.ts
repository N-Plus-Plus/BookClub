import type { Catalog, Movie, Session } from './types';
import { latestScores, scoreValue } from './ranking';
import { normalizedGenres } from './genres';

export const metricsScoreDimensions = [
  {id: 'imdb', label: 'IMDb', name: 'IMDb', provider: 'imdb', metric: 'rating', scale: 10},
  {id: 'letterboxd', label: 'LB', name: 'Letterboxd', provider: 'letterboxd', metric: 'rating', scale: 5},
  {id: 'metacritic', label: 'MC', name: 'Metacritic', provider: 'metacritic', metric: 'critic', scale: 100},
  {id: 'rt-audience', label: 'RT-A', name: 'Rotten Tomatoes - Audience', provider: 'rottentomatoes', metric: 'audience', scale: 100},
  {id: 'rt-critic', label: 'RT-C', name: 'Rotten Tomatoes - Critic', provider: 'rottentomatoes', metric: 'critic', scale: 100},
  {id: 'tmdb', label: 'TMDB', name: 'TMDB', provider: 'tmdb', metric: 'rating', scale: 10},
] as const;
export type MetricsScoreDimension = typeof metricsScoreDimensions[number]['id'];
export interface RankedAppearance extends Appearance { selectedScore: number }

export type MetricsFilter = {kind: 'all'} | {kind: 'member'; memberId: string} | {kind: 'classics'};
export interface Appearance { movie: Movie; session: Session; position: number; imdb: number | null }
export interface GenreMetric { genre: string; appearances: number; percentage: number; imdbAverage: number | null; imdbScored: number }
export interface Metrics {
  events: number; appearances: number; uniqueFilms: number; imdbAverage: number | null; imdbScored: number;
  genreCovered: number; uncategorised: number; top: RankedAppearance[]; bottom: RankedAppearance[]; genres: GenreMetric[];
}
const average = (rows: Appearance[]) => {
  const scores = rows.flatMap(a => a.imdb === null ? [] : [a.imdb]);
  return scores.length ? scores.reduce((sum,n) => sum+n,0)/scores.length : null;
};
const textOrder = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const tie = (a: Appearance,b: Appearance) => textOrder(a.session.event_date,b.session.event_date)
  || textOrder(a.movie.title,b.movie.title) || textOrder(a.session.id,b.session.id)
  || textOrder(a.movie.id,b.movie.id) || a.position-b.position;
export function calculateMetrics(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}, dimensions: {top?: MetricsScoreDimension; bottom?: MetricsScoreDimension} = {}): Metrics {
  const sessions = catalog.sessions.filter(s => !s.deleted_at && (filter.kind === 'all'
    || (filter.kind === 'classics' ? s.kind === 'classics' : s.kind === 'hosted' && s.host_member_id === filter.memberId)));
  const canonical = new Map(catalog.movies.map(m => [m.id,m]));
  const rows = sessions.flatMap(session => session.movies.map((film,i): Appearance => {
    const movie = canonical.get(film.id) ?? film;
    const score = latestScores(movie.scores).find(s => s.provider === 'imdb' && s.metric === 'rating');
    return {session,movie,position: i+1,imdb: score ? scoreValue(score)!/10 : null};
  }));
  const scored = rows.filter(a => a.imdb !== null);
  const ranked = (id: MetricsScoreDimension, descending: boolean): RankedAppearance[] => {
    const dimension = metricsScoreDimensions.find(d => d.id === id)!;
    return rows.flatMap(row => {
      const stored = latestScores(row.movie.scores).find(s => s.provider === dimension.provider && s.metric === dimension.metric);
      return stored ? [{...row,selectedScore: scoreValue(stored)! * dimension.scale / 100}] : [];
    }).sort((a,b) => (descending ? b.selectedScore-a.selectedScore : a.selectedScore-b.selectedScore) || tie(a,b)).slice(0,5);
  };
  const groups = new Map<string,Appearance[]>(); let genreCovered = 0;
  for (const row of rows) {
    const genres = normalizedGenres(row.movie.genres);
    if (genres.length) genreCovered++;
    for (const genre of genres.length ? genres : ['Uncategorised']) groups.set(genre,[...(groups.get(genre) ?? []),row]);
  }
  return {events: sessions.length,appearances: rows.length,uniqueFilms: new Set(rows.map(a => a.movie.id)).size,
    imdbAverage: average(rows),imdbScored: scored.length,genreCovered,uncategorised: rows.length-genreCovered,
    top: ranked(dimensions.top ?? 'imdb',true),
    bottom: ranked(dimensions.bottom ?? 'imdb',false),
    genres: [...groups].map(([genre,items]) => ({genre,appearances: items.length,percentage: items.length/rows.length*100,imdbAverage: average(items),imdbScored: items.filter(a => a.imdb !== null).length}))
      .sort((a,b) => b.appearances-a.appearances || textOrder(a.genre,b.genre))};
}
