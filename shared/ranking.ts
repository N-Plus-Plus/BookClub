import type { Member, Movie, Ranking, Score, SeenAnswer } from './types';

/** PROVISIONAL: demonstration policy only, not the historical spreadsheet algorithm.
 * Replacing this configuration and rankMovie replaces the policy everywhere.
 * Unknown answers never count as explicitly unseen. Latest snapshots per metric win.
 */
export const rankingConfig = {
  weights: { 'tmdb:rating': 1, 'imdb:rating': 2, 'demo-critic:rating': 1 } as Record<string, number>,
  defaultWeight: 1,
  unseenBonus: 2,
};

export function normalizeScore(value: number, scale: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0 || value < 0 || value > scale) return null;
  return value / scale * 100;
}

export function latestScores(scores: Score[]): Score[] {
  const latest = new Map<string, Score>();
  for (const score of scores) {
    const key = `${score.provider}:${score.metric}`;
    const previous = latest.get(key);
    if (!previous || score.fetched_at > previous.fetched_at) latest.set(key, score);
  }
  return [...latest.values()].sort((a, b) => `${a.provider}:${a.metric}`.localeCompare(`${b.provider}:${b.metric}`, 'en'));
}

export function rankMovie(scores: Score[], answers: SeenAnswer[], members: Member[]): Ranking {
  const active = members.filter(m => m.active === 1);
  const states = active.map(m => answers.find(a => a.member_id === m.id)?.seen);
  const seenCount = states.filter(s => s === 1).length;
  const unseenCount = states.filter(s => s === 0).length;
  const unknownCount = states.filter(s => s === undefined).length;
  const sources = latestScores(scores).flatMap(s => {
    const value = s.raw_scale ? normalizeScore(s.raw_value, s.raw_scale) : s.normalized_value;
    if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return [];
    return [{ provider: s.provider, metric: s.metric, value, weight: rankingConfig.weights[`${s.provider}:${s.metric}`] ?? rankingConfig.defaultWeight }];
  });
  const totalWeight = sources.reduce((n, s) => n + s.weight, 0);
  const weightedBaseScore = totalWeight ? sources.reduce((n, s) => n + s.value * s.weight, 0) / totalWeight : 0;
  const seenAdjustment = unseenCount * rankingConfig.unseenBonus;
  const warnings = ['Provisional ranking formula'];
  if (!sources.length) warnings.push('No usable source scores');
  if (sources.length < Object.keys(rankingConfig.weights).length) warnings.push('Some source scores are missing');
  if (unknownCount) warnings.push(`${unknownCount} seen answers unknown`);
  return { weightedBaseScore, seenCount, unseenCount, unknownCount, seenAdjustment,
    finalScore: weightedBaseScore + seenAdjustment,
    eligible: seenCount < 4 && (active.length > 0 && seenCount < active.length), warnings, sources };
}

export function sortClassics(movies: Movie[]): Movie[] {
  return [...movies].sort((a, b) => Number(b.ranking?.eligible) - Number(a.ranking?.eligible)
    || (b.ranking?.finalScore ?? 0) - (a.ranking?.finalScore ?? 0)
    || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
    || (a.year ?? 0) - (b.year ?? 0) || a.id.localeCompare(b.id, 'en'));
}

export function missingAnswers(movies: Movie[], members: Member[]) {
  return sortClassics(movies.filter(m => m.classic)).flatMap(movie => members.filter(m => m.active === 1)
    .filter(member => !movie.seen.some(s => s.member_id === member.id))
    .sort((a, b) => a.sort_order - b.sort_order).map(member => ({ movie, member })));
}
