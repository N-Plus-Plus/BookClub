import { describe, expect, it } from 'vitest';



import { ProductRepository } from '../worker/src/product-repository';


import type { BuilderSet, Catalog, HistoryAudit } from '../shared/types';

import { local, call, data, builder, turn, viewer, sessionData } from './helpers/product-api';

describe('private Builders and publication',()=>{
  it('keeps multiple ordered 4+ film sets private, including from admins',async()=>{
    const b=await builder(1,['moon','arrival','alien','bicycle','moon']);await builder();await builder(2);
    expect(b.movie_ids).toEqual(['moon','arrival','alien','bicycle','moon']);expect(await data<BuilderSet[]>(await call('/builders'))).toHaveLength(2);
    expect(await data<BuilderSet[]>(await call('/builders','GET',undefined,2))).toHaveLength(1);
    for(const admin of [2,3]) for(const [method,path,input] of [['GET',`/builders/${b.id}`,undefined],['PUT',`/builders/${b.id}`,{movie_ids:['alien'],revision:b.revision}],['DELETE',`/builders/${b.id}`,{revision:b.revision}],['POST',`/builders/${b.id}/publish`,{revision:b.revision,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:5,complete_turn:true,turn_version:0}]] as const) expect((await call(path,method,input,admin)).status).toBe(404);
    expect(JSON.stringify(await data<Catalog>(await call('/catalog')))).not.toContain('Private idea');
    expect((await call('/builders','POST',{owner_member_id:'member-2',movie_ids:[]})).status).toBe(422);
  });
  it('edits and deletes only own sets, with version conflicts',async()=>{
    const b=await builder();const update={revision:b.revision,title:'Updated',movie_ids:['alien','moon','arrival','bicycle']};
    const saved=await data<BuilderSet>(await call(`/builders/${b.id}`,'PUT',update));expect(saved.movie_ids).toEqual(update.movie_ids);expect(saved.created_at).toBe(b.created_at);
    expect((await call(`/builders/${b.id}`,'PUT',update)).status).toBe(409);expect((await call(`/builders/${b.id}`,'DELETE',{revision:b.revision})).status).toBe(409);
    expect((await call(`/builders/${b.id}`,'DELETE',{revision:saved.revision})).status).toBe(200);expect((await call(`/builders/${b.id}`)).status).toBe(404);
  });
  it('publishes atomically with original planning time, order, publisher, independent date and no backfill advancement',async()=>{
    await call('/sessions/demo-2','DELETE',undefined,2);
    const b=await builder(1,['moon','arrival','alien','bicycle']);const before=await turn();
    const published=await sessionData(await call(`/builders/${b.id}/publish`,'POST',{revision:b.revision,event_date:'2099-01-02',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false}));
    expect(published).toMatchObject({event_date:'2099-01-02',date_precision:'exact',planned_at:b.created_at,published_by:'member-1',host_member_id:'member-1',cycle_slot:2});expect(published.movies.map(m=>m.id)).toEqual(b.movie_ids);expect(published).not.toHaveProperty('title');expect(published).not.toHaveProperty('notes');expect(published).not.toHaveProperty('swap_note');
    expect((await call(`/builders/${b.id}`)).status).toBe(404);expect(await turn()).toEqual(before);
    expect((await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2000-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false})).status).toBe(404);
    await call(`/sessions/${published.id}`,'PUT',{event_date:'2001-01-01',kind:'hosted',host_member_id:'member-4',movie_ids:['alien']});
    expect((await sessionData(await call(`/sessions/${published.id}`))).planned_at).toBe(b.created_at);
    const audit=await data<HistoryAudit[]>(await call(`/sessions/${published.id}/audit`,'GET',undefined,2));expect(audit.map(a=>a.action).sort()).toEqual(['create','edit']);expect(audit.every(a=>a.actor_member_id==='member-1' && a.occurred_at)).toBe(true);
  });
  it('rolls back Builder removal, History, turn, Seen and audit on a failed join',async()=>{
    await call('/sessions/demo-classics','DELETE',undefined,2);
    const b=await builder(),before=await turn();const counts=local.sqlite.prepare('SELECT (SELECT count(*) FROM sessions) s,(SELECT count(*) FROM history_audit) a,(SELECT count(*) FROM seen_states) v').get();
    local.sqlite.exec("CREATE TRIGGER test_failure BEFORE INSERT ON session_movies BEGIN SELECT RAISE(ABORT,'fictional failure'); END");
    expect((await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2030-01-01',cycle_id:before.cycle_id,cycle_slot:5,complete_turn:true,turn_version:before.version})).status).toBe(500);
    expect((await call(`/builders/${b.id}`)).status).toBe(200);expect(await turn()).toEqual(before);expect(local.sqlite.prepare('SELECT (SELECT count(*) FROM sessions) s,(SELECT count(*) FROM history_audit) a,(SELECT count(*) FROM seen_states) v').get()).toEqual(counts);
  });
  it('rejects stale publication and empty Builder without deleting either',async()=>{
    const b=await builder();await call(`/builders/${b.id}`,'PUT',{revision:0,movie_ids:['alien']});
    expect((await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false})).status).toBe(409);
    const empty=await builder(1,[]);expect((await call(`/builders/${empty.id}/publish`,'POST',{revision:0,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false})).status).toBe(422);
  });
  it('guards publication against an edit between preflight and transaction',async()=>{
    const repo=new ProductRepository(local.db),b=await builder();await call(`/builders/${b.id}`,'PUT',{revision:0,movie_ids:['alien']});
    await expect(repo.saveSession({event_date:'2030-01-01',kind:'hosted',host_member_id:'member-1',movie_ids:b.movie_ids},await viewer(),undefined,b)).rejects.toMatchObject({status:409});expect((await repo.builder('member-1',b.id)).movie_ids).toEqual(['alien']);
  });
});

describe('Builder lineup write efficiency',()=>{
  it('skips identical ordered lineup writes for title/notes/repeated saves, still advances revisions; order/add/remove replace atomically',async()=>{
    const repo=new ProductRepository(local.db);let saved=await repo.saveBuilder('member-1',{title:'Original',notes:'Note',movie_ids:['moon','arrival','moon']});
    // SQLite triggers count actual relation writes, including deletes; no query-string-only assertion.
    local.sqlite.exec(`CREATE TABLE lineup_writes(kind TEXT);CREATE TRIGGER count_lineup_insert AFTER INSERT ON builder_movies BEGIN INSERT INTO lineup_writes VALUES('insert');END;CREATE TRIGGER count_lineup_delete AFTER DELETE ON builder_movies BEGIN INSERT INTO lineup_writes VALUES('delete');END;`);
    for (const fields of [{title:'Changed',notes:'Note'},{title:'Changed',notes:'Changed note'},{title:'Changed',notes:'Changed note'}]) {
      const revision=saved.revision;saved=await repo.saveBuilder('member-1',{...fields,movie_ids:saved.movie_ids,revision},saved.id,true);expect(saved.revision).toBe(revision+1);expect(local.sqlite.prepare('SELECT * FROM lineup_writes').all()).toEqual([]);
    }
    for (const movie_ids of [['arrival','moon','moon'],['arrival','moon','moon','arrival'],['moon']]) {
      const before=saved;local.sqlite.exec('DELETE FROM lineup_writes');saved=await repo.saveBuilder('member-1',{title:'Changed',movie_ids,revision:saved.revision},saved.id,true);
      expect(saved.movie_ids).toEqual(movie_ids);expect(local.sqlite.prepare("SELECT count(*) n FROM lineup_writes WHERE kind='delete'").get()?.n).toBe(before.movie_ids.length);expect(local.sqlite.prepare("SELECT count(*) n FROM lineup_writes WHERE kind='insert'").get()?.n).toBe(movie_ids.length);
    }
    await expect(repo.saveBuilder('member-1',{movie_ids:['arrival'],revision:saved.revision-1},saved.id,true)).rejects.toMatchObject({status:409});expect((await repo.builder('member-1',saved.id)).movie_ids).toEqual(['moon']);
  });
  it('returns creation order with deterministic ID ties despite later edits',async()=>{
    const repo=new ProductRepository(local.db);
    local.sqlite.exec("INSERT INTO builder_sets(id,owner_member_id,created_at,updated_at) VALUES('z','member-1','2030-01-01','2030-01-01'),('a','member-1','2030-01-01','2030-01-01'),('old','member-1','2000-01-01','2000-01-01')");
    await repo.saveBuilder('member-1',{title:'Edited',movie_ids:[],revision:0},'old',true);
    expect((await repo.builders('member-1')).map(set=>set.id)).toEqual(['old','a','z']);
  });
});
