import type { Catalog, Movie, Session } from './types';
import { latestScores, scoreValue } from './ranking';
import { normalizedGenres } from './genres';

export type MetricsFilter = {kind: 'all'} | {kind: 'member'; memberId: string} | {kind: 'classics'};
export interface Appearance { movie: Movie; session: Session; position: number; imdb: number | null }
export interface GenreMetric { genre: string; appearances: number; percentage: number; imdbAverage: number | null; imdbScored: number }
export interface Metrics {
  events: number; appearances: number; uniqueFilms: number; imdbAverage: number | null; imdbScored: number;
  genreCovered: number; uncategorised: number; top: Appearance[]; bottom: Appearance[]; genres: GenreMetric[];
}
const average = (rows: Appearance[]) => {
  const scores = rows.flatMap(a => a.imdb === null ? [] : [a.imdb]);
  return scores.length ? scores.reduce((sum,n) => sum+n,0)/scores.length : null;
};
const textOrder = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const tie = (a: Appearance,b: Appearance) => textOrder(a.session.event_date,b.session.event_date)
  || textOrder(a.movie.title,b.movie.title) || textOrder(a.session.id,b.session.id)
  || textOrder(a.movie.id,b.movie.id) || a.position-b.position;
export function calculateMetrics(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}): Metrics {
  const sessions = catalog.sessions.filter(s => !s.deleted_at && (filter.kind === 'all'
    || (filter.kind === 'classics' ? s.kind === 'classics' : s.kind === 'hosted' && s.host_member_id === filter.memberId)));
  const canonical = new Map(catalog.movies.map(m => [m.id,m]));
  const rows = sessions.flatMap(session => session.movies.map((film,i): Appearance => {
    const movie = canonical.get(film.id) ?? film;
    const score = latestScores(movie.scores).find(s => s.provider === 'imdb' && s.metric === 'rating');
    return {session,movie,position: i+1,imdb: score ? scoreValue(score)!/10 : null};
  }));
  const scored = rows.filter(a => a.imdb !== null);
  const groups = new Map<string,Appearance[]>(); let genreCovered = 0;
  for (const row of rows) {
    const genres = normalizedGenres(row.movie.genres);
    if (genres.length) genreCovered++;
    for (const genre of genres.length ? genres : ['Uncategorised']) groups.set(genre,[...(groups.get(genre) ?? []),row]);
  }
  return {events: sessions.length,appearances: rows.length,uniqueFilms: new Set(rows.map(a => a.movie.id)).size,
    imdbAverage: average(rows),imdbScored: scored.length,genreCovered,uncategorised: rows.length-genreCovered,
    top: [...scored].sort((a,b) => b.imdb!-a.imdb! || tie(a,b)).slice(0,5),
    bottom: [...scored].sort((a,b) => a.imdb!-b.imdb! || tie(a,b)).slice(0,5),
    genres: [...groups].map(([genre,items]) => ({genre,appearances: items.length,percentage: items.length/rows.length*100,imdbAverage: average(items),imdbScored: items.filter(a => a.imdb !== null).length}))
      .sort((a,b) => b.appearances-a.appearances || textOrder(a.genre,b.genre))};
}
