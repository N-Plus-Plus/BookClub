import { describe, expect, it } from 'vitest';

import worker from '../worker/src/index';




import type { Catalog, HistoryAudit } from '../shared/types';

import { local, env, call, data, builder, turn, session, sessionData } from './helpers/product-api';

describe('explicit rotation, Classics and History',()=>{
  it('requires admins for swaps, rejects generic correction and protects stale versions',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');
    const input={target_member_id:'member-3',version:1};
    expect((await call('/rotation/swap','POST',input)).status).toBe(403);
    expect((await call('/rotation/swap','POST',input,2)).status).toBe(200);
    expect((await call('/rotation/swap','POST',input,3)).status).toBe(409);
    expect((await call('/rotation/swap','POST',{target_member_id:'member-4',version:2},3)).status).toBe(200);
    expect((await call('/rotation/swap','POST',{...input,reason:'no'},2)).status).toBe(422);
    expect((await call('/rotation','PUT',{cycle_id:null,nominal_slot:1,version:3,reason:'no'},2)).status).toBe(404);
    expect(local.sqlite.prepare("SELECT count(*) n FROM history_audit WHERE action='rotation'").get()?.n).toBe(2);
  });
  it('migration leaves rotation uninitialised; swap cannot initialise it',async()=>{
    local.sqlite.exec('DELETE FROM club_rotation');expect(await data(await call('/rotation'))).toBeNull();
    expect((await call('/rotation/swap','POST',{target_member_id:'member-3',version:0},2)).status).toBe(409);
  });
  it('Classics completion marks all four Seen and awaits next slot 1; dates/calendar reads defer without effects',async()=>{
    await call('/sessions/demo-classics','DELETE',undefined,2);
    const state=await turn();const s=await sessionData(await session({kind:'classics',host_member_id:null,cycle_id:state.cycle_id,cycle_slot:5,complete_turn:true,turn_version:state.version,movie_ids:['moon','arrival']}));
    expect(await turn()).toMatchObject({nominal_slot:1,cycle_id:null,version:1});expect(local.sqlite.prepare("SELECT count(*) n FROM seen_states WHERE movie_id='moon' AND seen=1").get()?.n).toBe(4);
    const after=await turn();for(let i=0;i<3;i++) await call('/catalog');expect(await turn()).toEqual(after);
    expect((await session({kind:'classics',host_member_id:null,cycle_id:state.cycle_id,cycle_slot:5,complete_turn:true,turn_version:state.version})).status).toBe(409);
    await call('/movies/moon/seen/member-1','PUT',{seen:false});await call(`/sessions/${s.id}`,'PUT',{event_date:'2031-01-01',kind:'classics',movie_ids:['moon','alien'],cycle_id:s.cycle_id,cycle_slot:5});
    expect(local.sqlite.prepare("SELECT seen FROM seen_states WHERE movie_id='moon' AND member_id='member-1'").get()?.seen).toBe(1);expect(await turn()).toEqual(after);
  });
  it('backfilled Classics marks Seen without advancing rotation',async()=>{
    await call('/sessions/demo-classics','DELETE',undefined,2);
    const before=await turn(),seen=local.sqlite.prepare('SELECT * FROM seen_states ORDER BY movie_id,member_id').all();
    expect((await session({kind:'classics',host_member_id:null,cycle_id:before.cycle_id,cycle_slot:5,event_date:'1999-01-01'})).status).toBe(201);expect(await turn()).toEqual(before);expect(local.sqlite.prepare("SELECT seen FROM seen_states WHERE movie_id='moon'").all()).toEqual(Array.from({length:4},()=>({seen:1})));expect(local.sqlite.prepare("SELECT * FROM seen_states WHERE movie_id<>'moon' ORDER BY movie_id,member_id").all()).toEqual(seen.filter(row=>row.movie_id!=='moon'));
  });
  it('follows 1→2→3→4→5→next 1 with independent dates, derived host and permanent anchor',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET cycle_id=NULL,nominal_slot=1,version=version+1');
    let cycleId:string|null=null;
    for(let slot=1;slot<=5;slot++) {
      const state=await turn();expect(state.nominal_slot).toBe(slot);
      const s=await sessionData(await session({event_date:`2030-05-0${slot}`,cycle_id:state.cycle_id,cycle_slot:slot,complete_turn:true,turn_version:state.version,kind:slot===5?'classics':'hosted',host_member_id:slot===5?null:slot===1?'member-2':`member-${slot}`},slot===1?2:slot===5?1:slot));
      if(slot===1) cycleId=s.cycle_id;expect(s.cycle_id).toBe(cycleId);expect(s.date_precision).toBe('exact');expect(s.event_date).toBe(`2030-05-0${slot}`);
      expect(s.host_member_id).toBe(slot === 5 ? null : `member-${slot}`);
      const catalog=await data<Catalog>(await call('/catalog'));expect(catalog.cycles.find(c=>c.id===cycleId)?.rough_date).toBe('2030-05-01');
    }
    expect(await turn()).toMatchObject({nominal_slot:1,cycle_id:null});
    const state=await turn();const next=await sessionData(await session({event_date:'2040-04-04',cycle_id:null,cycle_slot:1,complete_turn:true,turn_version:state.version}));expect(next.cycle_id).not.toBe(cycleId);
    expect((await data<Catalog>(await call('/catalog'))).cycles.find(c=>c.id===next.cycle_id)?.rough_date).toBe('2040-04-04');
  });
  it('permits off-turn completion without requiring admin',async()=>{
    await call('/sessions/demo-2','DELETE',undefined,2);
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=2,version=version+1');
    const b=await builder();const input={revision:0,event_date:'2000-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:true,turn_version:1};
    const s=await sessionData(await call(`/builders/${b.id}/publish`,'POST',{...input}));expect(s).toMatchObject({host_member_id:'member-1',cycle_slot:2});expect((await turn()).nominal_slot).toBe(3);
  });
  it('concurrent completion advances once and preserves the losing Builder',async()=>{
    await call('/sessions/demo-classics','DELETE',undefined,2);
    const a=await builder(),b=await builder(2);const input={revision:0,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:5,complete_turn:true,turn_version:0};
    const responses=await Promise.all([call(`/builders/${a.id}/publish`,'POST',input),call(`/builders/${b.id}/publish`,'POST',input,2)]);expect(responses.map(r=>r.status).sort()).toEqual([201,409]);expect((await turn()).version).toBe(1);expect(local.sqlite.prepare('SELECT count(*) n FROM builder_sets').get()?.n).toBe(1);
  });
  it('rejects new cycles from later slots and invalid anchors; new exact dates preserve anchors',async()=>{
    await call('/sessions/demo-2','DELETE',undefined,2); await call('/sessions/demo-classics','DELETE',undefined,2);
    for(const slot of [2,3,4,5]) expect((await session({cycle_slot:slot,kind:slot===5?'classics':'hosted',host_member_id:slot===5?null:'member-1',new_cycle:{rough_date:'2030-05-06'}})).status).toBe(422);
    expect((await session({cycle_slot:1,new_cycle:{rough_date:'2030-01-01'}})).status).toBe(422);
    for(let slot=2;slot<=5;slot++) {
      local.sqlite.prepare('UPDATE club_rotation SET nominal_slot=?,version=version+1').run(slot);
      expect((await session({cycle_slot:slot,cycle_id:'demo-cycle-a',event_date:'2099-01-01',kind:slot===5?'classics':'hosted',host_member_id:slot===5?null:`member-${slot}`})).status).toBe(201);
    }
    expect((await data<Catalog>(await call('/catalog'))).cycles.find(c=>c.id==='demo-cycle-a')?.rough_date).toBe('2026-09-19');
  });
  it('requires deliberate slot-1 anchor correction, audits reference changes and preserves later exact dates/rotation',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=3,version=version+1');
    const before=await turn();
    const later=await sessionData(await session({event_date:'2099-01-01',cycle_id:'demo-cycle-a',cycle_slot:3},3));
    await call('/sessions/demo-classics','DELETE',undefined,2);
    const input={event_date:'2027-02-03',kind:'hosted',host_member_id:'member-1',cycle_id:'demo-cycle-a',cycle_slot:1,movie_ids:['arrival']};
    expect((await call('/sessions/demo-1','PUT',input)).status).toBe(422);
    expect((await call('/sessions/demo-1','PUT',{...input,correct_anchor:true})).status).toBe(200);
    const catalog=await data<Catalog>(await call('/catalog'));
    expect(catalog.cycles[0].rough_date).toBe(input.event_date);expect(catalog.sessions.find(s=>s.id==='demo-2')?.event_date).toBe(input.event_date);expect(catalog.sessions.find(s=>s.id===later.id)?.event_date).toBe('2099-01-01');expect(await turn()).toEqual(before);
    expect(await data<HistoryAudit[]>(await call('/sessions/demo-2/audit','GET',undefined,2))).toHaveLength(1);
    await call('/sessions/demo-classics/restore','POST',undefined,2);
    expect((await sessionData(await call('/sessions/demo-classics'))).event_date).toBe(input.event_date);expect(await turn()).toEqual(before);
  });
  it('anchor correction rolls back on failure and later-slot edits cannot change anchors',async()=>{
    local.sqlite.exec("CREATE TRIGGER fail_anchor_edit BEFORE UPDATE ON sessions WHEN NEW.id='demo-1' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
    const input={event_date:'2027-02-03',kind:'hosted',host_member_id:'member-1',cycle_id:'demo-cycle-a',cycle_slot:1,movie_ids:['arrival'],correct_anchor:true};
    expect((await call('/sessions/demo-1','PUT',input)).status).toBe(500);
    expect(local.sqlite.prepare('SELECT rough_date FROM cycles').get()?.rough_date).toBe('2026-09-19');expect(local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n).toBe(0);
    expect((await call('/sessions/demo-2','PUT',{...input,host_member_id:'member-2',cycle_slot:2,date_precision:'exact'},2)).status).toBe(200);
    expect(local.sqlite.prepare('SELECT rough_date FROM cycles').get()?.rough_date).toBe('2026-09-19');
  });
  it('audits edits/deletes, hides deleted events/appearances, preserves rotation and restricts restore',async()=>{
    const s=await sessionData(await session());const before=await turn();await call(`/sessions/${s.id}`,'PUT',{event_date:'2000-01-01',kind:'hosted',host_member_id:'member-3',movie_ids:['arrival','moon']},2);
    expect((await call(`/sessions/${s.id}`,'DELETE',undefined,2)).status).toBe(200);expect((await call(`/sessions/${s.id}`)).status).toBe(404);expect((await data<Catalog>(await call('/catalog'))).sessions.some(x=>x.id===s.id)).toBe(false);
    const detail=await data<{appearances:{id:string}[]}>(await call('/movies/moon'));expect(detail.appearances.some(a=>a.id===s.id)).toBe(false);expect(await turn()).toEqual(before);
    expect((await call(`/sessions/${s.id}/restore`,'POST')).status).toBe(403);expect((await call(`/sessions/${s.id}/restore`,'POST',undefined,2)).status).toBe(200);expect((await call(`/sessions/${s.id}`)).status).toBe(200);
    const audit=await data<HistoryAudit[]>(await call(`/sessions/${s.id}/audit`,'GET',undefined,2));expect(audit.map(a=>a.action).sort()).toEqual(['create','delete','edit','restore']);expect(audit.find(a=>a.action==='edit')?.actor_member_id).toBe('member-2');expect(await turn()).toEqual(before);
    expect(()=>local.sqlite.exec(`UPDATE sessions SET planned_at='changed' WHERE id='${s.id}'`)).toThrow('IMMUTABLE_PUBLICATION');
  });
  it('all new routes require authentication; local bypass never impersonates an owner or admin',async()=>{
    const protectedRoutes=[['/avatars','GET'],['/auth/avatar','POST'],['/rotation','GET'],['/rotation/swap','POST'],['/builders','GET'],['/builders/x','DELETE'],['/builders/x/publish','POST'],['/sessions/x/audit','GET'],['/sessions/x/restore','POST']];
    const db=env.DB;env.DB={} as D1Database;for(const [path,method] of protectedRoutes) expect((await worker.fetch(new Request(`http://api/api/v1${path}`,{method}),env)).status).toBe(401);
    env.DB=db;env.LOCAL_WRITE_BYPASS='true';for(const [path,method] of protectedRoutes.filter(([p,m])=>!(p==='/rotation'&&m==='GET'))) expect((await call(path,method,method==='GET'?undefined:{})).status).toBe(401);
  });
});

it('History permissions enforce stored host edits and admin-only delete/audit with no denied writes',async()=>{
 local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');
 const s=await sessionData(await session());const before=await turn();
 const update={event_date:'2031-01-01',movie_ids:['arrival'],host_member_id:'member-4',kind:'classics'};
 const auditBefore=local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n;
 expect((await call('/sessions/'+s.id,'PUT',update,4)).status).toBe(403);
 expect((await call('/sessions/'+s.id,'DELETE',undefined,1)).status).toBe(403);
 expect((await call('/sessions/'+s.id,'DELETE',undefined,4)).status).toBe(403);
 expect((await call('/sessions/'+s.id+'/audit','GET',undefined,1)).status).toBe(403);
 expect((await call('/sessions/'+s.id+'/audit','GET',undefined,4)).status).toBe(403);
 expect(await sessionData(await call('/sessions/'+s.id))).toEqual(s);expect(local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n).toBe(auditBefore);
 expect((await call('/sessions/'+s.id,'PUT',update,1)).status).toBe(200);
 expect(await sessionData(await call('/sessions/'+s.id))).toMatchObject({host_member_id:'member-1',kind:'hosted'});
 expect((await call('/sessions/demo-classics','PUT',update,1)).status).toBe(403);
 expect((await call('/sessions/demo-classics','PUT',update,2)).status).toBe(200);
 const catalog=await data<Catalog>(await call('/catalog'));expect(catalog.sessions.find(e=>e.id===s.id)?.has_audit).toBe(true);expect(catalog.sessions.find(e=>e.id==='demo-2')?.has_audit).toBe(false);
 expect((await call('/sessions/'+s.id+'/audit','GET',undefined,2)).status).toBe(200);
 expect((await call('/sessions/'+s.id,'DELETE',undefined,2)).status).toBe(200);expect(await turn()).toEqual(before);
});
