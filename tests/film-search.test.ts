import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { candidatePage, matchTitles, normalizeTitle, searchCandidates } from '../shared/search';
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
    env = {DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',TMDB_READ_TOKEN:'fictional',ALLOWED_ORIGINS:'http://localhost:4173'};
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
