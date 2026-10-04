import { afterEach, describe, expect, it, vi } from 'vitest';
import { MdbListProvider, parseMdbList } from '../worker/src/providers/mdblist';
import { OmdbProvider, parseOmdb } from '../worker/src/providers/omdb';
afterEach(()=>vi.unstubAllGlobals());
describe('rating providers',()=>{
  it('parses MDBList canonical sources, raw scales, votes and provenance',()=>{
    const scores=parseMdbList({ratings:[{source:'imdb',value:8.2,votes:100},{source:'tomatoes',value:95},{source:'popcorn',value:90},{source:'letterboxd',value:4.1},{source:'metacritic',value:88},{source:'tmdb',value:81}]},'2026-01-01T00:00:00Z');
    expect(scores).toHaveLength(6);expect(scores[0]).toMatchObject({provider:'imdb',raw_value:8.2,raw_scale:10,normalized_value:82,vote_count:100,retrieved_via:'mdblist'});
    expect(scores[2]).toMatchObject({provider:'rottentomatoes',metric:'audience'});
    expect(scores[5]).toMatchObject({raw_scale:100,normalized_value:81});
  });
  it('never invents absent or malformed scores; legitimate zero is valid',()=>{
    expect(parseMdbList({ratings:[{source:'imdb',value:null},{source:'tomatoes',value:''},{source:'popcorn',value:101},{source:'letterboxd',value:'N/A'},{source:'tmdb',value:0}]})).toHaveLength(1);
    expect(()=>parseMdbList({Error:'private'})).toThrow('unrecognised');
  });
  it('parses OMDb without fabricating RT audience',()=>{
    const scores=parseOmdb({Response:'True',imdbRating:'8.2',imdbVotes:'1,234',Metascore:'90',Ratings:[{Source:'Rotten Tomatoes',Value:'95%'}]});
    expect(scores).toHaveLength(3);expect(scores[0]).toMatchObject({raw_scale:10,vote_count:1234,retrieved_via:'omdb'});expect(scores.some(s=>s.metric==='audience')).toBe(false);
    expect(parseOmdb({Response:'True',imdbRating:'N/A',Metascore:'N/A'})).toEqual([]);
  });
  it('handles HTTP rate limits once with safe Retry-After',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response('secret upstream',{status:429,headers:{'Retry-After':'60'}}));vi.stubGlobal('fetch',fetch);
    await expect(new OmdbProvider('secret-key').scores('tt0000001')).rejects.toMatchObject({retryAfter:60,message:'OMDb rate limit reached. Try later.'});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('sanitises body and network failures',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('https://upstream?apikey=secret-key')));
    await expect(new MdbListProvider('secret-key').scores({provider:'imdb',external_id:'tt0000001'})).rejects.toThrow('could not return usable data');
    expect(()=>parseOmdb({Response:'False',Error:'secret-key'})).toThrow('could not supply');
  });
  it('uses one documented batch request with ID mapping',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json([{id:1,imdb_id:'tt0000001',ratings:[{source:'imdb',value:8}]}]));vi.stubGlobal('fetch',fetch);
    const scores=await new MdbListProvider('key').batch('imdb',['tt0000001']);expect(scores.get('tt0000001')).toHaveLength(1);expect(fetch.mock.calls[0][1].method).toBe('POST');
    await expect(new MdbListProvider('key').batch('imdb',Array(11).fill('tt0000001'))).rejects.toThrow('1–10');
  });
});
