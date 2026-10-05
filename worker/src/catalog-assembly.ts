import type { Asset, ExternalId, Member, Movie, Score, SeenAnswer } from '../../shared/types';
import { latestScores, rankMovie } from '../../shared/ranking';
type Linked<T> = T & {movie_id:string};
/** Consume each relationship exactly once and strip the internal join key. */
export function groupMovies<T>(rows: Linked<T>[]): Map<string,T[]> {
  const map = new Map<string,T[]>();
  for (const {movie_id,...child} of rows) {
    const group = map.get(movie_id) ?? []; group.push(child as T); map.set(movie_id,group);
  }
  return map;
}
export function assembleMovies(results: D1Result[], compact = false): Movie[] {
  const rows = <T>(i:number) => results[i].results as T[];
  const members = rows<Member>(0), assets = groupMovies(rows<Linked<Asset>>(2)), ids = groupMovies(rows<Linked<ExternalId>>(3)),
    scores = groupMovies(rows<Linked<Score>>(4)), seen = groupMovies(rows<Linked<SeenAnswer>>(5)),
    membership = groupMovies(rows<Linked<NonNullable<Movie['classics_membership']>>>(6)), genres = groupMovies(rows<Linked<{genre:string}>>(7));
  return rows<Omit<Movie,'scores'|'seen'|'classic'|'classics_membership'|'ranking'|'genres'|'assets'|'external_ids'>>(1).map(movie => {
    const source = scores.get(movie.id) ?? [], effective = compact ? latestScores(source) : source,
      answers = seen.get(movie.id) ?? [], classic = membership.get(movie.id)?.[0] ?? null;
    return {...movie,scores:effective,seen:answers,classic:Boolean(classic),classics_membership:classic,
      ranking:classic ? rankMovie(effective,answers,members,classic.rank_seed) : null,
      genres:(genres.get(movie.id) ?? []).map(g => g.genre),assets:assets.get(movie.id) ?? [],external_ids:ids.get(movie.id) ?? []};
  });
}
