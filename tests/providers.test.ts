import { afterEach, describe, expect, it, vi } from 'vitest';
import { TmdbProvider } from '../worker/src/providers/tmdb';
import { MovieService } from '../worker/src/services';
import type { Repository } from '../worker/src/repository';
import type { Env } from '../worker/src/http';
import type { Catalog, Movie } from '../shared/types';

afterEach(() => vi.unstubAllGlobals());
describe('provider-neutral TMDB snapshots',() => {
  it('maps details, identifiers, artwork and rating provenance',async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({id: 42,title: 'A Film',original_title: 'Un film',release_date: '2001-05-04',runtime: 100,overview: 'An overview',genres: [{name: 'Drama'}],poster_path: '/poster.jpg',backdrop_path: '/backdrop.jpg',vote_average: 8,vote_count: 100,external_ids: {imdb_id: 'tt0000042'}}));
    vi.stubGlobal('fetch',fetchMock);
    const result = await new TmdbProvider('test-credential').details('42');
    expect(result.year).toBe(2001); expect(result.genres).toEqual(['Drama']);
    expect(result.external_ids).toEqual([{provider: 'tmdb',external_id: '42'},{provider: 'imdb',external_id: 'tt0000042'}]);
    expect(result.assets.map(a => a.asset_type)).toEqual(['poster','backdrop']);
    expect(result.scores[0]).toMatchObject({provider: 'tmdb',metric: 'rating',raw_value: 8,raw_scale: 10,normalized_value: 80,vote_count: 100});
    expect(result.scores[0].fetched_at).toBe(result.fetched_at);
    expect(fetchMock.mock.calls[0][0]).not.toContain('test-credential');
  });
  it('handles absent metadata',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id: 42,title: 'A Film',vote_average: 0,vote_count: 0})));
    const result = await new TmdbProvider('test-credential').details('42');
    expect(result.year).toBeNull(); expect(result.runtime).toBeNull(); expect(result.assets).toEqual([]); expect(result.genres).toEqual([]);
  });
  it('search produces provider-neutral IDs rather than canonical local IDs',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({results: [{id: 42,title: 'A Film',release_date: '2001-05-04',poster_path: '/poster.jpg'}]})));
    const result = await new TmdbProvider('test-credential').search('A Film');
    expect(result[0]).toMatchObject({provider: 'tmdb',externalId: '42',title: 'A Film',year: 2001});
  });
  it('reports provider failure without raw payload or credentials',async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private upstream error',{status: 401})));
    await expect(new TmdbProvider('test-credential').details('42')).rejects.toThrow('TMDB lookup is unavailable');
  });
});
describe('optional lookup service',() => {
  const local = {id: 'local',title: 'Moon',original_title: null,year: 2009} as Movie;
  const repo = {catalog: async () => ({members: [],movies: [local],sessions: []} as Catalog)} as Repository;
  it('serves local search without invoking external APIs when credentials are absent',async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch',fetchMock);
    const result = await new MovieService(repo,{} as Env).search('moon');
    expect(result.local).toEqual([local]); expect(result.external).toEqual([]); expect(result.lookup.available).toBe(false); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps local results available when the optional provider fails',async () => {
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network unavailable')));
    const result = await new MovieService(repo,{TMDB_READ_TOKEN: 'test-credential'} as Env).search('moon');
    expect(result.local).toEqual([local]); expect(result.lookup.available).toBe(false); expect(result.lookup.message).toContain('could not be reached');
  });
});
