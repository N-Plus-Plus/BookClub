import { ratingDimensions, metricsRatingKeys } from './rating-dimensions';
import type { Catalog, Movie } from './types';
import { scoreValue } from './ranking';
import { normalizedGenres } from './genres';
import { scoresFor, average, matchesMetricsFilter, selectedAppearances, type Appearance, type MetricsFilter } from './metrics-summary';
export { metricsCatalog, metricsSummary, matchesMetricsFilter, selectedAppearances, type Appearance, type MetricsFilter } from './metrics-summary';

const once = <T>(calculate: () => T) => { let ready = false, value: T; return () => {if (!ready) {value=calculate();ready=true;} return value;}; };

export const metricsScoreDimensions = metricsRatingKeys.map(key => {
  const {id,compactLabel:label,name,provider,metric,scale} = ratingDimensions[key];
  return {id,label,name,provider,metric,scale};
});
export type MetricsScoreDimension = typeof metricsScoreDimensions[number]['id'];
export type MetricsScoreCategory = 'critic' | 'audience';
export type PopularityMeasure = 'imdb' | 'audience';
export interface RankedAppearance extends Appearance { selectedScore: number }

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
export function compositeScore(movie: Movie,kind: MetricsScoreCategory): number | null {
  const dimensions = metricsRatingKeys.map(key => ratingDimensions[key]).filter(d => d.group === kind);
  const scores = scoresFor(movie);
  const values = dimensions.flatMap(d => {
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
  const effective = new Map([...new Map(rows.map(row => [row.movie.id,row.movie])).values()].map(movie => [movie.id,scoresFor(movie)]));
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
/** Count only votes on each effective usable observation; never borrow an older snapshot's votes. */
export function audienceVotes(movie: Movie,measure: PopularityMeasure = 'imdb'): number | null {
  const dimensions = metricsRatingKeys.map(key => ratingDimensions[key]).filter(d => measure === 'imdb' ? d.id === 'imdb' : d.group === 'audience');
  const scores = scoresFor(movie);
  const votes = dimensions.flatMap(d => {
    const count = scores.find(s => s.provider === d.provider && s.metric === d.metric)?.vote_count;
    return typeof count === 'number' && Number.isFinite(count) && count > 0 ? [count] : [];
  });
  const total = votes.reduce((sum,count) => sum+count,0);
  return votes.length && Number.isFinite(total) ? total : null;
}
const imdbVotes = (movie: Movie) => audienceVotes(movie);
export function popularityMetrics(rows: Appearance[],measure: PopularityMeasure = 'imdb') {
  const qualifying: PopularAppearance[] = rows.flatMap(row => {
    const votes = audienceVotes(row.movie,measure);
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
    newest:tiedExtreme(unique,row => validReleaseDate(row.movie.release_date)),
    longest:tiedExtreme(unique,row => row.movie.runtime !== null && row.movie.runtime > 0 ? row.movie.runtime : null),
    shortest:tiedExtreme(unique,row => row.movie.runtime !== null && row.movie.runtime > 0 ? row.movie.runtime : null,'min'),
    mostPopular:tiedExtreme(unique,row => imdbVotes(row.movie)),
    mostObscure:tiedExtreme(unique,row => imdbVotes(row.movie),'min')};
}
export function validReleaseDate(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0,10) === value ? timestamp : null;
}
export function tiedExtreme<T>(items: readonly T[],value: (item:T) => number | null,direction: 'max' | 'min' = 'max'): {value:number;items:T[]} | null {
  const qualifying = items.flatMap(item => {const number=value(item);return number !== null && Number.isFinite(number) ? [{item,number}] : [];});
  if (!qualifying.length) return null;
  const extreme = qualifying.reduce((best,entry) => direction === 'max' ? Math.max(best,entry.number) : Math.min(best,entry.number),qualifying[0].number);
  return {value:extreme,items:qualifying.filter(entry => entry.number === extreme).map(entry => entry.item)};
}
export function metricsDashboard(rows: Appearance[],all: Appearance[]) {
  const fingerprint=once(()=>genreFingerprint(rows,all)), decades=once(()=>decadeDistribution(rows)), directors=once(()=>directorFingerprint(rows)),
    ratings=once(()=>ratingsProfile(rows)), popularity=once(()=>popularityMetrics(rows)), audiencePopularity=once(()=>popularityMetrics(rows,'audience')), extremes=once(()=>extremesCabinet(rows));
  return {get fingerprint(){return fingerprint();},get decades(){return decades();},get directors(){return directors();},
    get ratings(){return ratings();},get popularity(){return popularity();},get audiencePopularity(){return audiencePopularity();},get extremes(){return extremes();}};
}
const textOrder = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
const tie = (a: Appearance,b: Appearance) => textOrder(a.session.event_date,b.session.event_date)
  || textOrder(a.movie.title,b.movie.title) || textOrder(a.session.id,b.session.id)
  || textOrder(a.movie.id,b.movie.id) || a.position-b.position;
export function rankedMetricsAppearances(rows:Appearance[],kind:MetricsScoreCategory,descending:boolean):RankedAppearance[] {
  return rows.flatMap(row => {
    const selectedScore = compositeScore(row.movie,kind);
    return selectedScore === null ? [] : [{...row,selectedScore}];
  }).sort((a,b) => (descending ? b.selectedScore-a.selectedScore : a.selectedScore-b.selectedScore) || tie(a,b)).slice(0,5);
}
export function calculateMetrics(catalog: Catalog, filter: MetricsFilter = {kind: 'all'}, dimensions: {top?: MetricsScoreCategory; bottom?: MetricsScoreCategory} = {}, rows = selectedAppearances(catalog,filter)): Metrics {
  const scored = rows.filter(a => a.imdb !== null);
  const genreReport=once(() => {
  const groups = new Map<string,Appearance[]>(); let genreCovered = 0;
  for (const row of rows) {
    const genres = normalizedGenres(row.movie.genres);
    if (genres.length) genreCovered++;
    for (const genre of genres.length ? genres : ['Uncategorised']) {const items=groups.get(genre) ?? [];items.push(row);groups.set(genre,items);}
  }
  return {genreCovered,uncategorised:rows.length-genreCovered,genres:[...groups].map(([genre,items]) => ({genre,appearances:items.length,percentage:items.length/rows.length*100,imdbAverage:average(items),imdbScored:items.filter(a=>a.imdb !== null).length})).sort((a,b)=>b.appearances-a.appearances || textOrder(a.genre,b.genre))};
  });
  const top=once(()=>rankedMetricsAppearances(rows,dimensions.top ?? 'critic',true)),bottom=once(()=>rankedMetricsAppearances(rows,dimensions.bottom ?? 'critic',false));
  const events = catalog.sessions.filter(s => matchesMetricsFilter(s,filter)).length;
  return {events,appearances: rows.length,uniqueFilms: new Set(rows.map(a => a.movie.id)).size,
    imdbAverage: average(rows),imdbScored: scored.length,get genreCovered(){return genreReport().genreCovered;},get uncategorised(){return genreReport().uncategorised;},
    get top(){return top();},get bottom(){return bottom();},get genres(){return genreReport().genres;}};
}
