import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidatePage, fuzzyTitles, matchTitles, normalizeTitle, searchCandidates } from '../shared/search';
import { eventHost } from '../shared/event-host';
import type { Member, Rotation, SearchResponse, Session } from '../shared/types';
import { directors } from '../worker/src/providers/tmdb';
import { MovieService } from '../worker/src/services';
import { Repository } from '../worker/src/repository';
import worker from '../worker/src/index';
import { disposableD1 } from './d1';
import type { Env } from '../worker/src/http';

describe('shared film title matching',() => {
  const titles = ['Angel Has Fallen','Fallen Angels','Fallen','The Fallen','A Fallen','Things Fall Apart'].map(title => ({title}));
  it('matches only entire titles after whitespace/case and at most one article',() => {
    expect(matchTitles(titles,' Fallen ').map(movie => movie.title)).toEqual(['Fallen','The Fallen','A Fallen']);
    expect(normalizeTitle('  THE   Fallen  ')).toBe('fallen');
    expect(normalizeTitle('The A Fallen')).toBe('a fallen');
    expect(normalizeTitle('An Fallen')).toBe('an fallen');
    expect(matchTitles([{title:'Fallen 1998'}],'Fallen')).toEqual([{title:'Fallen 1998'}]);
  });
  it('falls back in relevance order only when strict matches are absent',() => {
    expect(matchTitles(titles.slice(0,2),'fallen')).toEqual(titles.slice(0,2));
    expect(matchTitles(titles,'fallen')).not.toContain(titles[0]);
  });
  it('folds apostrophes, punctuation, accents and whitespace while removing only one article',()=>{
    const titles=[{title:'The Astronaut’s Wife'},{title:'Amélie'},{title:'Spider-Man'},{title:'Spider Man 2'}];
    expect(matchTitles(titles,'The Astronauts Wife')).toEqual([titles[0]]);
    expect(matchTitles(titles,"astronaut's   wife")).toEqual([titles[0]]);
    expect(matchTitles(titles,'Amelie')).toEqual([titles[1]]);
    expect(matchTitles(titles,' AME\u0301LIE ')).toEqual([titles[1]]);
    expect(matchTitles(titles,'spiderman')).toEqual([titles[2]]);
    expect(matchTitles(titles,'spider   man')).toEqual([titles[2]]);
    expect(matchTitles(titles,'astronautswife')).toEqual([titles[0]]);
    expect(matchTitles(titles,'---')).toEqual([]);
  });
  it('ranks strong tokens and prefixes despite typos, incomplete words and long suffixes',()=>{
    const titles=['Sweeney Todd: The Demon Barber of Fleet Street','Todd and the Book of Pure Evil','Sweet November','Sweeney 2','Sweeney Todd'].map(title=>({title}));
    expect(fuzzyTitles(titles,'Sweeny Todd').map(movie=>movie.title)).toEqual(['Sweeney Todd',titles[0].title]);
    expect(fuzzyTitles(titles,'Sweeny Tod').map(movie=>movie.title)).toEqual(['Sweeney Todd',titles[0].title]);
    expect(fuzzyTitles(titles,'sweenytodd').map(movie=>movie.title)).toEqual(['Sweeney Todd',titles[0].title]);
    expect(fuzzyTitles([{title:'The Lord of the Rings: The Return of the King'}],'Lord Rings Return').length).toBe(1);
    for(const query of ['xyzzzz','Sweeny Road','Sweet Todd','xx','1998','---']) expect(fuzzyTitles(titles,query),query).toEqual([]);
    expect(fuzzyTitles([{title:'Live'},{title:'Somewhere'}],'Love')).toEqual([]);
  });
  it('caps fuzzy suggestions at four existing six-result pages with stable ties',()=>{
    const titles=Array.from({length:30},(_,id)=>({title:'Sweeney Todd',id}));
    const matched=fuzzyTitles(titles,'Sweeny Todd');
    expect(matched).toEqual(titles.slice(0,24));expect(candidatePage(matched,4).items).toHaveLength(6);
  });
  it('paginates six candidates with bounded transitions and local identity preference',() => {
    const results: SearchResponse = {local:[{id:'saved',title:'Film',year:null,tmdbId:'1',poster:null}],external:Array.from({length:14},(_,i) => ({provider:'tmdb',externalId:String(i+1),title:`Film ${i+1}`,year:null,poster:null})),lookup:{available:true,message:null}};
    const candidates = searchCandidates(results);
    expect(candidates).toHaveLength(14); expect(candidates[0].kind).toBe('local');
    expect(candidatePage(candidates,1)).toMatchObject({page:1,pages:3});
    expect(candidatePage(candidates,1).items).toHaveLength(6);
    expect(candidatePage(candidates,2).items).toEqual(candidates.slice(6,12));
    expect(candidatePage(candidates,3).items).toHaveLength(2);
    expect(candidatePage(candidates,99).page).toBe(3);
  });
});

describe('search, preview and Event API',() => {
  let local: ReturnType<typeof disposableD1>, repo: Repository, env: Env;
  const call = (path: string,method='GET',input?: unknown,member?: string) => worker.fetch(new Request(`http://api/api/v1${path}`,{method,...(member ? {headers:{'X-BookClub-Dev-Member':member}} : {}),...(input ? {body:JSON.stringify(input)} : {})}),env);
  const payload = async <T>(response: Response) => { expect(response.status,await response.clone().text()).toBeLessThan(300); return (await response.json() as {data:T}).data; };
  async function sessionPayload(response:Response):Promise<Session> {return (await payload<import('../shared/types').JournalMutationResult>(response)).session!;}
  beforeEach(() => {
    local = disposableD1(); local.sqlite.exec(readFileSync('worker/seed.sql','utf8')); repo = new Repository(local.db);
    env = {DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',TMDB_READ_TOKEN:'fictional',ALLOWED_ORIGINS:'http://localhost:10080'};
  });
  afterEach(() => { local.sqlite.close(); vi.unstubAllGlobals(); });
  it('searches narrow title fields without catalogue reconstruction, year matching or SQL wildcards',async () => {
    vi.spyOn(repo,'catalog').mockRejectedValue(new Error('Catalogue forbidden'));
    const movie = await repo.manualMovie({title:' The   FALLEN ',year:1998});
    expect(await repo.searchMovies('fallen')).toEqual([{id:movie,title:' The   FALLEN ',year:1998,tmdbId:null,poster:null}]);
    expect(await repo.searchMovies('1998')).toEqual([]); expect(await repo.searchMovies('%')).toEqual([]);
    const unicode = await repo.manualMovie({title:'THE ÉTÉ\u00a0\u00a0Film'});
    expect((await repo.searchMovies('été film')).map(movie => movie.id)).toEqual([unicode]);
    const response = await new MovieService(repo,{...env,TMDB_READ_TOKEN:undefined}).search('fallen');
    expect(response.local[0].id).toBe(movie); expect(repo.catalog).not.toHaveBeenCalled();
  });
  it('suppresses weaker candidates across providers and prefers the saved TMDB owner',async () => {
    const id = await repo.manualMovie({title:'The Fallen'});
    local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(id,'tmdb','42');
    vi.stubGlobal('fetch',vi.fn(async () => Response.json({results:[{id:42,title:'Fallen'},{id:43,title:'A Fallen'},{id:44,title:'Angel Has Fallen'},{id:45,title:'Fallen Angels'}]})));
    const result = await new MovieService(repo,env).search('Fallen');
    expect(result.local.map(movie => movie.id)).toEqual([id]); expect(result.external.map(movie => movie.externalId)).toEqual(['43']);
  });
  it('retains provider relevance order for substring fallback',async () => {
    vi.stubGlobal('fetch',vi.fn(async () => Response.json({results:[{id:44,title:'Angel Has Fallen'},{id:45,title:'Fallen Angels'},{id:46,title:'Unrelated'}]})));
    expect((await new MovieService(repo,env).search('Fallen')).external.map(movie => movie.externalId)).toEqual(['44','45']);
  });
  it('finds normalized titles locally and uses fuzzy suggestions only after zero normal matches',async()=>{
    const wife=await repo.manualMovie({title:"The Astronaut's Wife"});
    const amelie=await repo.manualMovie({title:'Amélie'});
    const todd=await repo.manualMovie({title:'Sweeney Todd: The Demon Barber of Fleet Street'});
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const service=new MovieService(repo,{...env,TMDB_READ_TOKEN:undefined});
    for(const [query,id] of [['The Astronauts Wife',wife],['Amelie',amelie],['AstronautsWife',wife]]) {
      const result=await service.search(query);expect(result.local.map(movie=>movie.id)).toEqual([id]);
      expect(result.lookup.message).not.toContain('similar titles');
    }
    const result=await service.search('Sweeny Todd');
    expect(result.local.map(movie=>movie.id)).toEqual([todd]);expect(result.external).toEqual([]);
    expect(result.lookup).toMatchObject({available:false,message:expect.stringContaining('Showing similar titles')});
    expect(result.lookup.message).toContain('not configured');
    expect((await service.search('Sweeney Tod')).lookup.message).not.toContain('similar titles');
    expect((await service.search('Unrelated nonsense')).local).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not invoke fuzzy retrieval when ordinary discovery returns a match',async()=>{
    await repo.manualMovie({title:'Sweeney Todd'});await repo.manualMovie({title:'Sweeny Todd Returns'});
    const search=vi.spyOn(repo,'searchMovies');
    const result=await new MovieService(repo,{...env,TMDB_READ_TOKEN:undefined}).search('Sweeny Todd');
    expect(result.local.map(movie=>movie.title)).toEqual(['Sweeny Todd Returns']);
    expect(result.lookup.message).not.toContain('similar titles');expect(search).toHaveBeenCalledTimes(1);
  });
  it('reuses existing provider results for fuzzy discovery and keeps canonical identity preference',async()=>{
    const owner=await repo.manualMovie({title:'Sweeney Todd: The Demon Barber of Fleet Street'});
    local.sqlite.prepare('INSERT INTO movie_external_ids VALUES(?,?,?)').run(owner,'tmdb','42');
    const fetch=vi.fn(async()=>Response.json({results:[{id:42,title:'Sweeney Todd'},{id:43,title:'Sweet November'},{id:44,title:'Sweeney Todd Returns'}]}));vi.stubGlobal('fetch',fetch);
    const result=await new MovieService(repo,env).search('Sweeny Todd');
    expect(result.local.map(movie=>movie.id)).toEqual([owner]);expect(result.external.map(movie=>movie.externalId)).toEqual(['44']);
    expect(result.lookup).toMatchObject({available:true,message:expect.stringContaining('Showing similar titles')});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('extracts only directors and joins multiple distinct names naturally',() => {
    expect(directors([{job:'Director',name:'One'},{job:'Producer',name:'Other'},{job:'Director',name:'Two'},{job:'Director',name:'One'}])).toBe('One and Two');
    expect(directors()).toBeNull();
  });
  it('preview returns identity and credits without any database writes or canonical IDs',async () => {
    const before = local.sqlite.prepare('SELECT total_changes() n').get()?.n;
    const fetch = vi.fn(async (_url: string) => Response.json({id:42,title:'Fallen',original_title:'Fallen',release_date:'1998-01-16',runtime:124,overview:'Fictional',genres:[{name:'Thriller'}],poster_path:'/p.jpg',backdrop_path:'/b.jpg',credits:{crew:[{job:'Director',name:'Gregory Hoblit'}]}})); vi.stubGlobal('fetch',fetch);
    const result = await payload<Record<string,unknown>>(await call('/movies/preview/tmdb/42'));
    expect(result).toMatchObject({externalId:'42',title:'Fallen',director:'Gregory Hoblit',year:1998,runtime:124});
    expect(result).not.toHaveProperty('id'); expect(result).not.toHaveProperty('seen');
    expect(fetch.mock.calls[0][0]).toContain('append_to_response=credits');
    expect(local.sqlite.prepare('SELECT total_changes() n').get()?.n).toBe(before);
  });
  it('preview honours cooldowns, including expired rows, without writing D1 on failure',async () => {
    local.sqlite.prepare('INSERT INTO provider_cooldowns(provider,retry_after_until,updated_at) VALUES(?,?,?)').run('tmdb','2000-01-01','2000-01-01');
    const before = local.sqlite.prepare('SELECT total_changes() n').get()?.n;
    const fetch = vi.fn(async () => new Response(null,{status:429,headers:{'Retry-After':'60'}})); vi.stubGlobal('fetch',fetch);
    expect((await call('/movies/preview/tmdb/42')).status).toBe(503);
    expect(local.sqlite.prepare('SELECT total_changes() n').get()?.n).toBe(before);
    local.sqlite.exec("UPDATE provider_cooldowns SET retry_after_until='2200-01-01'"); fetch.mockClear();
    expect((await call('/movies/preview/tmdb/42')).status).toBe(503); expect(fetch).not.toHaveBeenCalled();
  });
  it('derives a new human host independently of viewer, supplied host and completion',async () => {
    local.sqlite.exec("UPDATE club_rotation SET nominal_slot=3,version=version+1");
    const session = await sessionPayload(await call('/sessions','POST',{event_date:'2030-01-01',kind:'classics',host_member_id:'member-1',complete_turn:false,movie_ids:['moon']}));
    expect(session).toMatchObject({kind:'hosted',host_member_id:'member-3'});
    local.sqlite.exec("UPDATE members SET active=0 WHERE id='member-3'");
    const failure = await call('/sessions','POST',{event_date:'2030-01-02',movie_ids:['moon']});
    expect(failure.status).toBe(422); expect(await failure.text()).toContain('current turn has no active member');
  });
  it('derives Classics and preserves historical host/kind even after deactivation',async () => {
    const created = await sessionPayload(await call('/sessions','POST',{event_date:'2030-01-01',host_member_id:'member-1',movie_ids:['moon']}));
    expect(created).toMatchObject({kind:'classics',host_member_id:null});
    local.sqlite.exec("UPDATE members SET role='admin' WHERE id='member-1'; UPDATE members SET active=0 WHERE id='member-2'");
    const corrected = await sessionPayload(await call('/sessions/demo-2','PUT',{event_date:'2026-09-19',kind:'classics',host_member_id:null,cycle_id:'demo-cycle-a',cycle_slot:2,date_precision:'cycle_rough',movie_ids:['moon']},'member-1'));
    expect(corrected).toMatchObject({kind:'hosted',host_member_id:'member-2'});
  });
  it('shares the client host derivation and rejects missing rotation',() => {
    const members = [{id:'member-2',sort_order:2,active:1}] as Member[];
    expect(eventHost(members,{nominal_slot:2} as Rotation)).toEqual({kind:'hosted',host_member_id:'member-2'});
    expect(eventHost(members,{nominal_slot:5} as Rotation)).toEqual({kind:'classics',host_member_id:null});
    expect(() => eventHost(members,null)).toThrow('current turn is unavailable');
    expect(eventHost(members,null,{kind:'hosted',host_member_id:'historical'})).toEqual({kind:'hosted',host_member_id:'historical'});
  });
});
