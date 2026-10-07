import type { Catalog, Movie, Session } from './types';
import { latestScores, scoreValue } from './ranking';
import { normalizedGenres } from './genres';

export const metricsScoreDimensions = [
  {id: 'imdb', label: 'IMDb', name: 'IMDb', provider: 'imdb', metric: 'rating', scale: 10},
  {id: 'letterboxd', label: 'LB', name: 'Letterboxd', provider: 'letterboxd', metric: 'rating', scale: 5},
  {id: 'metacritic', label: 'MC', name: 'Metacritic', provider: 'metacritic', metric: 'critic', scale: 100},
  {id: 'metacritic-user', label: 'MC-U', name: 'Metacritic User', provider: 'metacritic', metric: 'user', scale: 10},
  {id: 'rt-audience', label: 'RT-A', name: 'Rotten Tomatoes - Audience', provider: 'rottentomatoes', metric: 'audience', scale: 100},
  {id: 'rt-critic', label: 'RT-C', name: 'Rotten Tomatoes - Critic', provider: 'rottentomatoes', metric: 'critic', scale: 100},
  {id: 'tmdb', label: 'TMDB', name: 'TMDB', provider: 'tmdb', metric: 'rating', scale: 10},
  {id: 'trakt', label: 'Trakt', name: 'Trakt', provider: 'trakt', metric: 'rating', scale: 100},
  {id: 'ebert', label: 'Ebert', name: 'Roger Ebert', provider: 'rogerebert', metric: 'rating', scale: 4},
] as const;
export type MetricsScoreDimension = typeof metricsScoreDimensions[number]['id'];
export interface RankedAppearance extends Appearance { selectedScore: number }

export type MetricsFilter = {kind: 'all'} | {kind: 'member'; memberId: string} | {kind: 'classics'};
export function matchesMetricsFilter(session: Session,filter: MetricsFilter): boolean {
  return !session.deleted_at && (filter.kind === 'all' || (filter.kind === 'classics' ? session.kind === 'classics' : session.kind === 'hosted' && session.host_member_id === filter.memberId));
}
export interface Appearance { movie: Movie; session: Session; position: number; imdb: number | null }
export interface GenreMetric { genre: string; appearances: number; percentage: number; imdbAverage: number | null; imdbScored: number }
export interface Metrics {
  events: number; appearances: number; uniqueFilms: number; imdbAverage: number | null; imdbScored: number;
  genreCovered: number; uncategorised: number; top: RankedAppearance[]; bottom: RankedAppearance[]; genres: GenreMetric[];
}

/** Chart identities use palette tokens only, independently of the selected ranking. */
export const metricsPalette = ['ruby','grapefruit','carrot','pumpkin','sunflower','avacado','grass','emerald','aqua','sapphire','jeans','indigo','lavender','rose'] as const;
export function genreColour(genre: string): string {
  let hash = 0;
  for (const character of genre) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return metricsPalette[hash % metricsPalette.length];
}
export function median(values: readonly number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  const middle = Math.floor(sorted.length/2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2 : null;
}
const share = (count: number,total: number) => total ? count/total*100 : 0;
/** Keep at least limit entries from an ordered ranking, including cutoff ties. */
export function withCutoffTies<T>(items: readonly T[],value: (item:T) => number,limit = 5): T[] {
  if (items.length <= limit) return [...items];
  const cutoff = value(items[limit-1]);
  return items.filter((item,index) => index < limit || value(item) === cutoff);
}
export function compositeScore(movie: Movie,kind: 'audience' | 'critic'): number | null {
  const ids: MetricsScoreDimension[] = kind === 'audience' ? ['imdb','letterboxd','metacritic-user','rt-audience','tmdb','trakt'] : ['metacritic','rt-critic','ebert'];
  const scores = latestScores(movie.scores);
  const values = metricsScoreDimensions.filter(d => ids.includes(d.id)).flatMap(d => {
    const observation = scores.find(s => s.provider === d.provider && s.metric === d.metric);
    const value = observation ? scoreValue(observation) : null;
    return value === null ? [] : [value];
  });
  return values.length ? values.reduce((sum,value) => sum+value,0)/values.length : null;
}
export interface FingerprintGenre { genre: string; count: number; percentage: number; ratio: number; colour: string }
export function genreFingerprint(selected: Appearance[],all: Appearance[]): FingerprintGenre[] {
  const counts = (rows: Appearance[]) => {
    const groups = new Map<string,number>();
    for (const row of rows) for (const genre of normalizedGenres(row.movie.genres)) groups.set(genre,(groups.get(genre) ?? 0)+1);
    return groups;
  };
  const baseline = counts(all);
  return [...counts(selected)].flatMap(([genre,count]) => {
    const clubShare = share(baseline.get(genre) ?? 0,all.length);
    return clubShare ? [{genre,count,percentage:share(count,selected.length),ratio:share(count,selected.length)/clubShare,colour:genreColour(genre)}] : [];
  }).sort((a,b) => b.ratio-a.ratio || b.percentage-a.percentage || b.count-a.count || textOrder(a.genre,b.genre)).slice(0,5);
}
export function contributorMetrics(catalog: Catalog,all = selectedAppearances(catalog)) {
  const identities: {label: string; filter: MetricsFilter}[] = [
    ...catalog.members.filter(m => m.sort_order >= 1 && m.sort_order <= 4).sort((a,b) => a.sort_order-b.sort_order || textOrder(a.id,b.id)).map(m => ({label:m.display_name.toUpperCase(),filter:{kind:'member' as const,memberId:m.id}})),
    {label:'CLSC',filter:{kind:'classics'}},
  ];
  return identities.map(identity => {
    const rows = all.filter(row => matchesMetricsFilter(row.session,identity.filter));
    return {...identity,count:rows.length,signature:genreFingerprint(rows,all)[0] ?? null};
  });
}
export function decadeDistribution(rows: Appearance[]) {
  const groups = new Map<number | null,number>();
  for (const {movie} of rows) {
    const decade = movie.year !== null && Number.isFinite(movie.year) && movie.year > 0 ? Math.floor(movie.year/10)*10 : null;
    groups.set(decade,(groups.get(decade) ?? 0)+1);
  }
  return [...groups].sort(([a],[b]) => a === null ? 1 : b === null ? -1 : a-b).map(([decade,count]) => ({
    decade,label:decade === null ? 'Unknown' : `${decade}s`,count,percentage:share(count,rows.length),
    colour:decade === null ? 'lavender' : metricsPalette[((decade-1920)/10 % metricsPalette.length+metricsPalette.length) % metricsPalette.length],
  }));
}
export function directorFingerprint(rows: Appearance[]) {
  const groups = new Map<string,number>(); let covered = 0;
  for (const {movie} of rows) if (movie.director?.trim()) {
    covered++; groups.set(movie.director,(groups.get(movie.director) ?? 0)+1);
  }
  return {covered,top:withCutoffTies([...groups].sort(([a,ac],[b,bc]) => bc-ac || textOrder(a,b)),item => item[1]).map(([name,count],index) => ({name,count,percentage:share(count,rows.length),colour:metricsPalette[(index+6)%metricsPalette.length]}))};
}
export function ratingsProfile(rows: Appearance[]) {
  const effective = new Map([...new Map(rows.map(row => [row.movie.id,row.movie])).values()].map(movie => [movie.id,latestScores(movie.scores)]));
  return metricsScoreDimensions.map((dimension,index) => {
    const values = rows.flatMap(row => {
      const observation = effective.get(row.movie.id)!.find(s => s.provider === dimension.provider && s.metric === dimension.metric);
      return observation ? [scoreValue(observation)!] : [];
    });
    return {...dimension,colour:metricsPalette[index+5],coverage:values.length,mean:values.length ? values.reduce((sum,value) => sum+value,0)/values.length : null,median:median(values)};
  });
}
export function uniqueAppearances(rows: Appearance[]): Appearance[] {
  const unique = new Map<string,Appearance>();
  for (const row of [...rows].sort(tie)) if (!unique.has(row.movie.id)) unique.set(row.movie.id,row);
  return [...unique.values()];
}
export interface PopularAppearance extends Appearance { votes: number }
function imdbVotes(movie: Movie): number | null {
  const votes = latestScores(movie.scores).find(s => s.provider === 'imdb' && s.metric === 'rating')?.vote_count;
  return typeof votes === 'number' && Number.isFinite(votes) && votes > 0 ? votes : null;
}
export function popularityMetrics(rows: Appearance[]) {
  const qualifying: PopularAppearance[] = rows.flatMap(row => {
    const votes = imdbVotes(row.movie);
    return votes !== null ? [{...row,votes}] : [];
  });
  const unique = uniqueAppearances(qualifying) as PopularAppearance[];
  return {coverage:qualifying.length,median:median(qualifying.map(row => row.votes)),
    popular:[...unique].sort((a,b) => b.votes-a.votes || tie(a,b)).slice(0,5),
    obscure:[...unique].sort((a,b) => a.votes-b.votes || tie(a,b)).slice(0,5)};
}
export function extremesCabinet(rows: Appearance[]) {
  const unique = uniqueAppearances(rows);
  return {highest:tiedExtreme(unique,row => row.imdb),lowest:tiedExtreme(unique,row => row.imdb,'min'),
    topCritic:tiedExtreme(unique,row => compositeScore(row.movie,'critic')),bottomCritic:tiedExtreme(unique,row => compositeScore(row.movie,'critic'),'min'),
    topAudience:tiedExtreme(unique,row => compositeScore(row.movie,'audience')),bottomAudience:tiedExtreme(unique,row => compositeScore(row.movie,'audience'),'min'),
    oldest:tiedExtreme(unique,row => row.movie.year !== null && row.movie.year > 0 ? row.movie.year : null,'min'),
    longest:tiedExtreme(unique,row => row.movie.runtime !== null && row.movie.runtime > 0 ? row.movie.runtime : null),
    mostPopular:tiedExtreme(unique,row => imdbVotes(row.movie)),
    mostObscure:tiedExtreme(unique,row => imdbVotes(row.movie),'min')};
}
export function tiedExtreme<T>(items: readonly T[],value: (item:T) => number | null,direction: 'max' | 'min' = 'max'): {value:number;items:T[]} | null {
  const qualifying = items.filter(item => {const number = value(item);return number !== null && Number.isFinite(number);});
  if (!qualifying.length) return null;
  const extreme = qualifying.reduce((best,item) => direction === 'max' ? Math.max(best,value(item)!) : Math.min(best,value(item)!),value(qualifying[0])!);
  return {value:extreme,items:qualifying.filter(item => value(item) === extreme)};
}
export function metricsDashboard(rows: Appearance[],all: Appearance[]) {
  return {fingerprint:genreFingerprint(rows,all),decades:decadeDistribution(rows),directors:directorFingerprint(rows),
    ratings:ratingsProfile(rows),popularity:popularityMetrics(rows),extremes:extremesCabinet(rows)};
}
const average = (rows: Appearance[]) => {
  const scores = rows.flatMap(a => a.imdb === null ? [] : [a.imdb]);
  return scores.length ? scores.reduce((sum,n) => sum+n,0)/scores.length : null;
};
const textOrder = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const tie = (a: Appearance,b: Appearance) => textOrder(a.session.event_date,b.session.event_date)
  || textOrder(a.movie.title,b.movie.title) || textOrder(a.session.id,b.session.id)
  || textOrder(a.movie.id,b.movie.id) || a.position-b.position;
export function selectedAppearances(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}): Appearance[] {
  const sessions = catalog.sessions.filter(s => matchesMetricsFilter(s,filter));
  const canonical = new Map(catalog.movies.map(m => [m.id,m]));
  const imdbByMovie = new Map<string,number | null>();
  return sessions.flatMap(session => session.movies.map((film,i): Appearance => {
    const movie = canonical.get(film.id) ?? film;
    if (!imdbByMovie.has(movie.id)) {
      const score = latestScores(movie.scores).find(s => s.provider === 'imdb' && s.metric === 'rating');
      imdbByMovie.set(movie.id,score ? scoreValue(score)!/10 : null);
    }
    return {session,movie,position: i+1,imdb: imdbByMovie.get(movie.id)!};
  }));
}
export function calculateMetrics(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}, dimensions: {top?: MetricsScoreDimension; bottom?: MetricsScoreDimension} = {}, rows = selectedAppearances(catalog,filter)): Metrics {
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
  const events = catalog.sessions.filter(s => matchesMetricsFilter(s,filter)).length;
  return {events,appearances: rows.length,uniqueFilms: new Set(rows.map(a => a.movie.id)).size,
    imdbAverage: average(rows),imdbScored: scored.length,genreCovered,uncategorised: rows.length-genreCovered,
    top: ranked(dimensions.top ?? 'imdb',true),
    bottom: ranked(dimensions.bottom ?? 'imdb',false),
    genres: [...groups].map(([genre,items]) => ({genre,appearances: items.length,percentage: items.length/rows.length*100,imdbAverage: average(items),imdbScored: items.filter(a => a.imdb !== null).length}))
      .sort((a,b) => b.appearances-a.appearances || textOrder(a.genre,b.genre))};
}
