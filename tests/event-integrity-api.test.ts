import { beforeEach, describe, expect, it } from 'vitest';






import type { BuilderSet } from '../shared/types';

import { local, call, data, builder, turn, session, sessionData } from './helpers/product-api';

describe('active slots and universal swap integrity',()=>{
  beforeEach(() => { local.sqlite.exec('UPDATE club_rotation SET nominal_slot=3,version=version+1'); });
  it('rejects duplicate active slots safely, allows different cycles/slots and unrestricted null slots',async()=>{
    const s=await sessionData(await session({cycle_id:'demo-cycle-a',cycle_slot:3},3));
    const duplicate=await session({cycle_id:'demo-cycle-a',cycle_slot:3},3);expect(duplicate.status).toBe(409);expect(await duplicate.text()).toContain('already has an active');
    expect((await session({cycle_id:'demo-cycle-a',cycle_slot:4},4)).status).toBe(201);
    local.sqlite.exec("INSERT INTO cycles(id,ordinal,rough_date) VALUES('other',2,'2000-01-01')");
    expect((await session({cycle_id:'other',cycle_slot:3},3)).status).toBe(201);
    for(let i=0;i<2;i++) {expect((await session()).status).toBe(201);expect((await session({cycle_id:'other'})).status).toBe(201);}
    const ungrouped=await sessionData(await session());
    expect((await call(`/sessions/${ungrouped.id}`,'PUT',{event_date:'2000-01-01',kind:'hosted',host_member_id:'member-3',cycle_id:'demo-cycle-a',cycle_slot:3,movie_ids:['moon']},2)).status).toBe(409);
    expect((await sessionData(await call(`/sessions/${s.id}`))).cycle_slot).toBe(3);
  });
  it('soft deletion frees a slot; restore succeeds when free and returns 409 when replaced',async()=>{
    const s=await sessionData(await session({cycle_id:'demo-cycle-a',cycle_slot:3},3));
    await call(`/sessions/${s.id}`,'DELETE',undefined,2);expect((await call(`/sessions/${s.id}/restore`,'POST',undefined,2)).status).toBe(200);
    await call(`/sessions/${s.id}`,'DELETE',undefined,2);expect((await session({cycle_id:'demo-cycle-a',cycle_slot:3},3)).status).toBe(201);
    const auditCount=local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n;
    const response=await call(`/sessions/${s.id}/restore`,'POST',undefined,2);expect(response.status).toBe(409);expect(await response.text()).not.toContain('UNIQUE');
    expect(local.sqlite.prepare('SELECT deleted_at FROM sessions WHERE id=?').get(s.id)?.deleted_at).toBeTruthy();expect(local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n).toBe(auditCount);
  });
  it('Builder and current completion cannot occupy filled slots or change private sets/rotation/Seen',async()=>{
    const b=await builder(),before=await turn();const seen=local.sqlite.prepare('SELECT * FROM seen_states').all();
    for(const complete_turn of [false,true]) expect((await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2000-01-01',cycle_id:'demo-cycle-a',cycle_slot:5,complete_turn,turn_version:0})).status).toBe(409);
    expect((await session({cycle_id:'demo-cycle-a',cycle_slot:5,kind:'classics',host_member_id:null,complete_turn:true,turn_version:0})).status).toBe(409);
    expect(await turn()).toEqual(before);expect(await data<BuilderSet>(await call(`/builders/${b.id}`))).toEqual(b);expect(local.sqlite.prepare('SELECT * FROM seen_states').all()).toEqual(seen);
  });
  it('preserves published historical hosts on edits and derives current completion hosts',async()=>{
    const before=await turn(),backfill={cycle_id:'demo-cycle-a',cycle_slot:3};
    const b=await builder();
    const s=await sessionData(await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2000-01-01',...backfill,complete_turn:false}));
    expect(s.host_member_id).toBe('member-1');expect(await turn()).toEqual(before);
    expect((await call(`/sessions/${s.id}`,'PUT',{event_date:s.event_date,kind:'hosted',host_member_id:'member-2',...backfill,movie_ids:['moon']})).status).toBe(200);
    expect((await sessionData(await call(`/sessions/${s.id}`))).host_member_id).toBe('member-1');
    await call('/sessions/demo-2','DELETE',undefined,2);local.sqlite.exec("UPDATE club_rotation SET nominal_slot=2,version=version+1");
    const completed = await sessionData(await session({cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:true,turn_version:2}));
    expect(completed.host_member_id).toBe('member-2');
  });
  it('DB index and triggers cannot be bypassed by direct SQL, including updates and transaction races',async()=>{
    expect(()=>local.sqlite.exec("INSERT INTO sessions(id,event_date,host_member_id,cycle_id,cycle_slot) VALUES('duplicate','2000-01-01','member-2','demo-cycle-a',2)")).toThrow('UNIQUE');
    // Bypass repository preflight by interleaving a write immediately before batch.
    const batch=local.db.batch.bind(local.db);let raced=false;
    local.db.batch=(async (statements:D1PreparedStatement[])=>{if(!raced){raced=true;local.sqlite.exec("INSERT INTO sessions(id,event_date,host_member_id,cycle_id,cycle_slot) VALUES('raced','2000-01-01','member-3','demo-cycle-a',3)");}return batch(statements);}) as D1Database['batch'];
    expect((await session({cycle_id:'demo-cycle-a',cycle_slot:3},3)).status).toBe(409);
  });
});
