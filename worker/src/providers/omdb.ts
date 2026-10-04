import type { Score } from '../../../shared/types';
import { RatingError, ratingRequest, record } from './ratings';
export function parseOmdb(data: unknown, at = new Date().toISOString()): Score[] {
  if (!data || typeof data !== 'object') throw new RatingError('OMDb returned an unrecognised response.');
  const d = data as {Response?: string; imdbRating?: unknown; imdbVotes?: unknown; Metascore?: unknown; Ratings?: {Source: string; Value: string}[]};
  if (d.Response === 'False') throw new RatingError('OMDb could not supply this film. Check configuration, quota or IMDb ID.');
  if (d.Response !== 'True') throw new RatingError('OMDb returned an unrecognised response.');
  const scores = [record('imdb','rating',d.imdbRating,10,'omdb',at,d.imdbVotes),record('metacritic','critic',d.Metascore,100,'omdb',at)];
  if (Array.isArray(d.Ratings)) {
    const critic = d.Ratings.find(r => r?.Source === 'Rotten Tomatoes');
    if (critic && /^\d+(\.\d+)?%$/.test(critic.Value)) scores.push(record('rottentomatoes','critic',critic.Value.slice(0,-1),100,'omdb',at));
  }
  return scores.filter((s): s is Score => s !== null);
}
export class OmdbProvider {
  constructor(private key: string) {}
  async scores(id: string) {
    return parseOmdb(await ratingRequest(`https://www.omdbapi.com/?apikey=${encodeURIComponent(this.key)}&i=${encodeURIComponent(id)}&type=movie`,'OMDb'));
  }
}
