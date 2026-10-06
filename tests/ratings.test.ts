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
    await expect(new MdbListProvider('secret-key').scores({provider:'imdb',external_id:'tt0000001'})).rejects.toThrow('could not be reached');
    expect(()=>parseOmdb({Response:'False',Error:'secret-key'})).toThrow('could not supply');
  });
  it('uses one documented batch request with ID mapping',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json([{id:360,ids:{imdb:'tt0000001',tmdb:278},ratings:[{source:'imdb',value:8}]}]));vi.stubGlobal('fetch',fetch);
    const scores=await new MdbListProvider('key').batch('imdb',['tt0000001']);expect(scores.get('tt0000001')).toHaveLength(1);expect(fetch.mock.calls[0][1].method).toBe('POST');
    await expect(new MdbListProvider('key').batch('imdb',Array(11).fill('tt0000001'))).rejects.toThrow('1–10');
  });
  it.each(['imdb','tmdb'])('correlates reordered %s entries using provider-scoped IDs and ignores unrelated entries',async(provider)=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      const ids=provider==='imdb'?['tt0111161','tt0133093']:['278','603'];
      const fetch=vi.fn().mockResolvedValue(Response.json([
        {id:469990,ids:{imdb:'tt0133093',tmdb:'603'},ratings:[{source:'imdb',value:8}]},
        {id:360,ids:{imdb:'tt0111161',tmdb:278},ratings:[]},
        {id:278,ids:{imdb:'tt9999999',tmdb:999},ratings:'invalid unrelated ratings'},
        {id:603,ratings:'invalid unrelated ratings'},null,
      ]));vi.stubGlobal('fetch',fetch);
      const result=await new MdbListProvider('secret-key').batch(provider,ids);
      expect([...result.keys()]).toEqual([ids[1],ids[0]]);
      expect(result.get(ids[0])).toEqual([]);expect(result.get(ids[1])?.[0]).toMatchObject({normalized_value:80});
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ids:provider==='tmdb'?[278,603]:ids});
      expect(warn).not.toHaveBeenCalled();
    } finally {warn.mockRestore();}
  });
  it('retains the documented imdb_id fallback',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json([{imdb_id:'tt0111161',ratings:[]}])));
    expect((await new MdbListProvider('key').batch('imdb',['tt0111161'])).get('tt0111161')).toEqual([]);
  });
  it('leaves omitted IDs absent and logs only safe aggregate correlation diagnostics',async()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json([{id:360,ids:{imdb:'tt0111161',tmdb:278},private:'private payload',ratings:[]}])));
      const result=await new MdbListProvider('secret-key').batch('imdb',['tt0111161','tt0133093']);
      expect(result.has('tt0133093')).toBe(false);
      expect(warn).toHaveBeenCalledWith('MDBList batch correlation incomplete',{provider:'imdb',requested:2,returned:1,matched:1,nestedImdb:1,nestedTmdb:1,legacyImdb:0});
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/secret-key|private payload|tt0111161/);
    } finally {warn.mockRestore();}
  });
  it('still rejects malformed ratings for a matched entry and non-array batch responses',async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json([{ids:{tmdb:278},ratings:'invalid'}]));vi.stubGlobal('fetch',fetch);
    await expect(new MdbListProvider('key').batch('tmdb',['278'])).rejects.toThrow('unrecognised ratings response');
    fetch.mockResolvedValue(Response.json({private:'upstream payload'}));
    await expect(new MdbListProvider('key').batch('imdb',['tt0111161'])).rejects.toThrow('unrecognised batch response');
  });
});
