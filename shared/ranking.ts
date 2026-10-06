import type { Member, Movie, Ranking, Score, SeenAnswer } from './types';
export const requiredScores = ['imdb:rating','rottentomatoes:audience','rottentomatoes:critic','letterboxd:rating','metacritic:critic','tmdb:rating'] as const;
export function normalizeScore(value: number, scale: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0 || value < 0 || value > scale) return null;
  return value / scale * 100;
}
export const scoreServiceOrder = ['mdblist','omdb','legacy-spreadsheet','development-demo','unspecified'];
export const tmdbScoreServiceOrder = ['tmdb','mdblist','legacy-spreadsheet'];
const precedence = (s: Score) => {
  const via = s.retrieved_via ?? (s.provider === 'tmdb' ? 'tmdb' : 'unspecified');
  const order = s.provider === 'tmdb' ? tmdbScoreServiceOrder : scoreServiceOrder;
  const index = order.indexOf(via); return index < 0 ? order.length : index;
};
export function scoreValue(s: Score): number | null {
  const value = s.raw_scale !== null ? normalizeScore(s.raw_value,s.raw_scale) : s.normalized_value;
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
/** Preferred retrieval service first, then latest usable snapshot. */
export function latestScores(scores: Score[]): Score[] {
  const sorted = [...scores].filter(s => scoreValue(s) !== null).sort((a,b) => precedence(a)-precedence(b)
    || Date.parse(b.fetched_at)-Date.parse(a.fetched_at)
    || (a.retrieved_via === 'legacy-spreadsheet' && b.retrieved_via === 'legacy-spreadsheet' ? (b.legacy_preferred ?? 0)-(a.legacy_preferred ?? 0) || (b.source_ordinal ?? 0)-(a.source_ordinal ?? 0) : 0)
    || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const effective = new Map<string,Score>();
  for (const s of sorted) { const key = `${s.provider}:${s.metric}`; if (!effective.has(key)) effective.set(key,s); }
  return [...effective.values()].sort((a,b) => `${a.provider}:${a.metric}`.localeCompare(`${b.provider}:${b.metric}`,'en'));
}
export const liveScoreServices = ['mdblist','omdb','tmdb'] as const;
export const legacyScoreLiveCutoff = 3;
export function isLiveScore(s: Score): boolean {
  return liveScoreServices.includes((s.retrieved_via ?? (s.provider === 'tmdb' ? 'tmdb' : 'unspecified')) as typeof liveScoreServices[number]);
}
/** Actual usable provider observations, independently of ranking bootstrap eligibility. */
export function liveScoreDimensions(scores: Score[]): string[] {
  return [...new Set(scores.filter(s => isLiveScore(s) && scoreValue(s) !== null)
    .map(s => `${s.provider}:${s.metric}`).filter(key => requiredScores.includes(key as typeof requiredScores[number])))];
}
export function missingLiveScoreDimensions(scores: Score[]): string[] {
  const available = liveScoreDimensions(scores);
  return requiredScores.filter(key => !available.includes(key));
}
/** Legacy observations bootstrap ranking only until three distinct live dimensions exist. */
export function effectiveRankingScores(scores: Score[]): Score[] {
  const live = liveScoreDimensions(scores), retired = live.length >= legacyScoreLiveCutoff;
  return latestScores(scores.filter(s => retired ? isLiveScore(s) : s.retrieved_via !== 'legacy-spreadsheet'
    || !live.includes(`${s.provider}:${s.metric}`)))
    .filter(s => requiredScores.includes(`${s.provider}:${s.metric}` as typeof requiredScores[number]));
}
export function rankMovie(scores: Score[], answers: SeenAnswer[], members: Member[], seed = 0): Ranking {
  const active = members.filter(m => m.active === 1), states = active.map(m => answers.find(a => a.member_id === m.id)?.seen);
  const seenCount = states.filter(s => s === 1).length, unseenCount = states.filter(s => s === 0).length;
  const unknownCount = states.filter(s => s !== 0 && s !== 1).length;
  const sources = effectiveRankingScores(scores)
    .map(s => ({provider: s.provider,metric: s.metric,value: scoreValue(s)!,retrieved_via: s.retrieved_via ?? 'unspecified'}));
  const missingRequiredScores = requiredScores.filter(key => !sources.some(s => `${s.provider}:${s.metric}` === key));
  const availableScoreAverage = sources.length ? sources.reduce((sum,s) => sum+s.value,0)/sources.length : null;
  const imputedScores = availableScoreAverage === null ? [] : missingRequiredScores.map(key => {
    const [provider,metric] = key.split(':');
    return {provider,metric,value:availableScoreAverage};
  });
  const rankable = sources.length > 0 && unknownCount === 0 && active.length > 0;
  const rawScore = availableScoreAverage === null ? null : [...sources,...imputedScores].reduce((sum,s) => sum+s.value**2,0);
  const unseenMultiplier = 1.025 ** unseenCount, tieBreak = seed * 0.00001;
  const eligible = active.length > 0 && seenCount < active.length;
  const finalScore = rawScore === null ? null : rawScore * unseenMultiplier + tieBreak;
  const residualScore = finalScore === null ? null : finalScore * (eligible ? 1 : -1);
  const warnings = [...(missingRequiredScores.length ? [availableScoreAverage === null ? 'No usable Watch Order ratings' : 'Missing ratings use the available-score average'] : []),
    ...(unknownCount ? [`${unknownCount} seen answers unknown`] : []), ...(active.length ? [] : ['No active members'])];
  return {rawScore,seenCount,unseenCount,unknownCount,unseenMultiplier,tieBreak,residualScore,finalScore,availableScoreAverage,imputedScores,rankable,eligible,missingRequiredScores,warnings,sources};
}
export function sortClassics(movies: Movie[]): Movie[] {
  return [...movies].sort((a,b) => Number(Boolean(b.ranking?.eligible && b.ranking.rankable))-Number(Boolean(a.ranking?.eligible && a.ranking.rankable))
    || Number(b.ranking?.eligible)-Number(a.ranking?.eligible)
    || (b.ranking?.finalScore ?? -Infinity)-(a.ranking?.finalScore ?? -Infinity)
    || a.title.localeCompare(b.title,'en',{sensitivity: 'base'}) || (a.year ?? 0)-(b.year ?? 0) || a.id.localeCompare(b.id,'en'));
}
export function missingAnswers(movies: Movie[], members: Member[], viewerId: string, historyMovieIds: ReadonlySet<string> = new Set()) {
  return sortClassics(movies.filter(m => m.classic && !historyMovieIds.has(m.id))).flatMap(movie => members.filter(m => m.active === 1 && m.id === viewerId)
    .filter(member => !movie.seen.some(s => s.member_id === member.id))
    .sort((a,b) => a.sort_order-b.sort_order).map(member => ({movie,member})));
}
