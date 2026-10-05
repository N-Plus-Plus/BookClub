import type { FilmCandidate, SearchResponse } from './types';

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g,' ').toLowerCase().replace(/^(a|the) /,'');
}
export function matchTitles<T extends {title: string}>(candidates: T[], query: string): T[] {
  const term = normalizeTitle(query);
  const strict = candidates.filter(candidate => normalizeTitle(candidate.title) === term);
  return strict.length ? strict : candidates.filter(candidate => normalizeTitle(candidate.title).includes(term));
}
export const SEARCH_PAGE_SIZE = 6;
export function searchCandidates(results: SearchResponse): FilmCandidate[] {
  const localIds = new Set(results.local.map(movie => movie.tmdbId).filter(Boolean));
  return [...results.local.map(movie => ({kind:'local' as const,movie})),
    ...results.external.filter(movie => !localIds.has(movie.externalId)).map(movie => ({kind:'external' as const,movie}))];
}
export function candidatePage<T>(candidates: T[], page: number) {
  const pages = Math.max(1,Math.ceil(candidates.length / SEARCH_PAGE_SIZE));
  const current = Math.max(1,Math.min(page,pages));
  return {items:candidates.slice((current-1)*SEARCH_PAGE_SIZE,current*SEARCH_PAGE_SIZE),page:current,pages};
}
