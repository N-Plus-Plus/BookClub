import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../worker/src/index';
import { hashToken } from '../worker/src/auth';
import { ProductRepository } from '../worker/src/product-repository';
import { disposableD1 } from './d1';
import { identityPresentation, needsAvatar } from '../shared/identity';
import type { BuilderSet, Catalog, HistoryAudit, Rotation, Session, Viewer } from '../shared/types';
import type { Env } from '../worker/src/http';
let local: ReturnType<typeof disposableD1>, env: Env;
const tokens = ['1','2','3','4'].map(n => n.repeat(64));
const call = (path: string,method='GET',input?: unknown,member=1) => worker.fetch(new Request(`http://api/api/v1${path}`,{method,headers: {Authorization: `Bearer ${tokens[member-1]}`},...(input === undefined ? {} : {body: JSON.stringify(input)})}),env);
async function data<T>(response: Response): Promise<T> { expect(response.ok,await response.clone().text()).toBe(true); return (await response.json() as {data: T}).data; }
const builder = (member=1,films=['arrival','moon']) => call('/builders','POST',{title:'Private idea',notes:'Only its owner sees this',movie_ids:films},member).then(data<BuilderSet>);
const turn = () => call('/rotation').then(data<Rotation>);
const viewer = (member=1) => call('/auth/me','GET',undefined,member).then(data<{viewer: Viewer}>).then(r=>r.viewer);
const session = (input: Record<string,unknown>={},member=1) => call('/sessions','POST',{event_date:'2030-05-06',kind:'hosted',host_member_id:`member-${member}`,movie_ids:['moon'],...input},member);
beforeEach(async () => {
  local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));
  env={DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'false',ALLOWED_ORIGINS:'http://localhost:5173'};
  for (let i=1;i<=4;i++) {
    local.sqlite.prepare('UPDATE members SET role=? WHERE id=?').run(i===2||i===3?'admin':'member',`member-${i}`);
    local.sqlite.prepare('INSERT INTO member_auth(member_id,authorized_email,google_sub) VALUES(?,?,?)').run(`member-${i}`,`test${i}@example.invalid`,`fake-sub-${i}`);
    local.sqlite.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?)').run(await hashToken(tokens[i-1]),`member-${i}`,'2000-01-01','2200-01-01');
  }
});
afterEach(()=>local.sqlite.close());
describe('active slots and universal swap integrity',()=>{
  beforeEach(() => { local.sqlite.exec('UPDATE club_rotation SET nominal_slot=3,version=version+1'); });
  it('rejects duplicate active slots safely, allows different cycles/slots and unrestricted null slots',async()=>{
    const s=await data<Session>(await session({cycle_id:'demo-cycle-a',cycle_slot:3},3));
    const duplicate=await session({cycle_id:'demo-cycle-a',cycle_slot:3},3);expect(duplicate.status).toBe(409);expect(await duplicate.text()).toContain('already has an active');
    expect((await session({cycle_id:'demo-cycle-a',cycle_slot:4},4)).status).toBe(201);
    local.sqlite.exec("INSERT INTO cycles(id,ordinal,rough_date) VALUES('other',2,'2000-01-01')");
    expect((await session({cycle_id:'other',cycle_slot:3},3)).status).toBe(201);
    for(let i=0;i<2;i++) {expect((await session()).status).toBe(201);expect((await session({cycle_id:'other'})).status).toBe(201);}
    const ungrouped=await data<Session>(await session());
    expect((await call(`/sessions/${ungrouped.id}`,'PUT',{event_date:'2000-01-01',kind:'hosted',host_member_id:'member-3',cycle_id:'demo-cycle-a',cycle_slot:3,movie_ids:['moon']})).status).toBe(409);
    expect((await data<Session>(await call(`/sessions/${s.id}`))).cycle_slot).toBe(3);
  });
  it('soft deletion frees a slot; restore succeeds when free and returns 409 when replaced',async()=>{
    const s=await data<Session>(await session({cycle_id:'demo-cycle-a',cycle_slot:3},3));
    await call(`/sessions/${s.id}`,'DELETE');expect((await call(`/sessions/${s.id}/restore`,'POST',undefined,2)).status).toBe(200);
    await call(`/sessions/${s.id}`,'DELETE');expect((await session({cycle_id:'demo-cycle-a',cycle_slot:3},3)).status).toBe(201);
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
    const s=await data<Session>(await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2000-01-01',...backfill,complete_turn:false}));
    expect(s.host_member_id).toBe('member-1');expect(await turn()).toEqual(before);
    expect((await call(`/sessions/${s.id}`,'PUT',{event_date:s.event_date,kind:'hosted',host_member_id:'member-2',...backfill,movie_ids:['moon']})).status).toBe(200);
    expect((await data<Session>(await call(`/sessions/${s.id}`))).host_member_id).toBe('member-1');
    await call('/sessions/demo-2','DELETE');local.sqlite.exec("UPDATE club_rotation SET nominal_slot=2,version=version+1");
    const completed = await data<Session>(await session({cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:true,turn_version:2}));
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
describe('member avatars and roles',()=>{
  it('returns nullable avatars/roles and requires onboarding, including pre-existing sessions',async()=>{
    const member=await viewer(),admin=await viewer(2);expect(member.role).toBe('member');expect(admin.role).toBe('admin');expect(needsAvatar(member)).toBe(true);
    expect(await data<number[]>(await call('/avatars'))).toHaveLength(20);
    const claimed=await data<Viewer>(await call('/auth/avatar','POST',{avatar:0}));expect(claimed).toMatchObject({id:'member-1',avatar:0});expect(needsAvatar(claimed)).toBe(false);expect(needsAvatar(null)).toBe(false);
    expect((await viewer()).avatar).toBe(0);expect(await data<number[]>(await call('/avatars'))).not.toContain(0);
  });
  it('accepts 0–19 and rejects Classics, fractions, range and owner spoofing',async()=>{
    for(let avatar=0;avatar<20;avatar++) {
      local.sqlite.exec("UPDATE members SET avatar=NULL WHERE id='member-1'");expect((await call('/auth/avatar','POST',{avatar})).status).toBe(200);
    }
    for(const avatar of ['a',-1,20,1.5,null]) expect((await call('/auth/avatar','POST',{avatar})).status).toBe(422);
    expect((await call('/auth/avatar','POST',{avatar:3,member_id:'member-2'})).status).toBe(422);
  });
  it('enforces DB uniqueness, safe collision and one-time claims',async()=>{
    const results=await Promise.all([call('/auth/avatar','POST',{avatar:5}),call('/auth/avatar','POST',{avatar:5},2)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(local.sqlite.prepare('SELECT count(*) n FROM members WHERE avatar=5').get()?.n).toBe(1);
    expect(()=>local.sqlite.exec("UPDATE members SET avatar=5 WHERE id='member-4'")).toThrow();expect(()=>local.sqlite.exec("UPDATE members SET avatar=20 WHERE id='member-4'")).toThrow();
    expect(()=>local.sqlite.exec("UPDATE members SET avatar=1.5 WHERE id='member-4'")).toThrow();
    expect((await call('/auth/avatar','POST',{avatar:6})).status).toBe(409);
    expect(await (await call('/auth/avatar','POST',{avatar:5},4)).text()).not.toContain('UNIQUE constraint');
  });
  it('uses explicit Classics presentation and base-aware member assets',()=>{
    expect(identityPresentation({kind:'classics'},'/BookClub/')).toEqual({name:'CLSC',avatar:'/BookClub/avatars/a.png'});
    expect(identityPresentation({kind:'classics'},'/')).toEqual({name:'CLSC',avatar:'/avatars/a.png'});
    expect(identityPresentation({kind:'member',member:{id:'x',display_name:'Test',avatar:0}},'/BookClub/')).toEqual({name:'TEST',avatar:'/BookClub/avatars/0.png'});
  });
});
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
    await call('/sessions/demo-2','DELETE');
    const b=await builder(1,['moon','arrival','alien','bicycle']);const before=await turn();
    const published=await data<Session>(await call(`/builders/${b.id}/publish`,'POST',{revision:b.revision,event_date:'2099-01-02',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false}));
    expect(published).toMatchObject({event_date:'2099-01-02',date_precision:'exact',planned_at:b.created_at,published_by:'member-1',host_member_id:'member-1',cycle_slot:2});expect(published.movies.map(m=>m.id)).toEqual(b.movie_ids);expect(published).not.toHaveProperty('title');expect(published).not.toHaveProperty('notes');expect(published).not.toHaveProperty('swap_note');
    expect((await call(`/builders/${b.id}`)).status).toBe(404);expect(await turn()).toEqual(before);
    expect((await call(`/builders/${b.id}/publish`,'POST',{revision:0,event_date:'2000-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:false})).status).toBe(404);
    await call(`/sessions/${published.id}`,'PUT',{event_date:'2001-01-01',kind:'hosted',host_member_id:'member-4',movie_ids:['alien']});
    expect((await data<Session>(await call(`/sessions/${published.id}`))).planned_at).toBe(b.created_at);
    const audit=await data<HistoryAudit[]>(await call(`/sessions/${published.id}/audit`));expect(audit.map(a=>a.action).sort()).toEqual(['create','edit']);expect(audit.every(a=>a.actor_member_id==='member-1' && a.occurred_at)).toBe(true);
  });
  it('rolls back Builder removal, History, turn, Seen and audit on a failed join',async()=>{
    await call('/sessions/demo-classics','DELETE');
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
    await call('/sessions/demo-classics','DELETE');
    const state=await turn();const s=await data<Session>(await session({kind:'classics',host_member_id:null,cycle_id:state.cycle_id,cycle_slot:5,complete_turn:true,turn_version:state.version,movie_ids:['moon','arrival']}));
    expect(await turn()).toMatchObject({nominal_slot:1,cycle_id:null,version:1});expect(local.sqlite.prepare("SELECT count(*) n FROM seen_states WHERE movie_id='moon' AND seen=1").get()?.n).toBe(4);
    const after=await turn();for(let i=0;i<3;i++) await call('/catalog');expect(await turn()).toEqual(after);
    expect((await session({kind:'classics',host_member_id:null,cycle_id:state.cycle_id,cycle_slot:5,complete_turn:true,turn_version:state.version})).status).toBe(409);
    await call('/movies/moon/seen/member-1','PUT',{seen:false});await call(`/sessions/${s.id}`,'PUT',{event_date:'2031-01-01',kind:'classics',movie_ids:['moon','alien'],cycle_id:s.cycle_id,cycle_slot:5});
    expect(local.sqlite.prepare("SELECT seen FROM seen_states WHERE movie_id='moon' AND member_id='member-1'").get()?.seen).toBe(0);expect(await turn()).toEqual(after);
  });
  it('backfilled Classics neither marks Seen nor advances rotation',async()=>{
    await call('/sessions/demo-classics','DELETE');
    const before=await turn(),seen=local.sqlite.prepare('SELECT * FROM seen_states ORDER BY movie_id,member_id').all();
    expect((await session({kind:'classics',host_member_id:null,cycle_id:before.cycle_id,cycle_slot:5,event_date:'1999-01-01'})).status).toBe(201);expect(await turn()).toEqual(before);expect(local.sqlite.prepare('SELECT * FROM seen_states ORDER BY movie_id,member_id').all()).toEqual(seen);
  });
  it('follows 1→2→3→4→5→next 1 with independent dates, derived host and permanent anchor',async()=>{
    local.sqlite.exec('UPDATE club_rotation SET cycle_id=NULL,nominal_slot=1,version=version+1');
    let cycleId:string|null=null;
    for(let slot=1;slot<=5;slot++) {
      const state=await turn();expect(state.nominal_slot).toBe(slot);
      const s=await data<Session>(await session({event_date:`2030-05-0${slot}`,cycle_id:state.cycle_id,cycle_slot:slot,complete_turn:true,turn_version:state.version,kind:slot===5?'classics':'hosted',host_member_id:slot===5?null:slot===1?'member-2':`member-${slot}`},slot===1?2:slot===5?1:slot));
      if(slot===1) cycleId=s.cycle_id;expect(s.cycle_id).toBe(cycleId);expect(s.date_precision).toBe('exact');expect(s.event_date).toBe(`2030-05-0${slot}`);
      expect(s.host_member_id).toBe(slot === 5 ? null : `member-${slot}`);
      const catalog=await data<Catalog>(await call('/catalog'));expect(catalog.cycles.find(c=>c.id===cycleId)?.rough_date).toBe('2030-05-01');
    }
    expect(await turn()).toMatchObject({nominal_slot:1,cycle_id:null});
    const state=await turn();const next=await data<Session>(await session({event_date:'2040-04-04',cycle_id:null,cycle_slot:1,complete_turn:true,turn_version:state.version}));expect(next.cycle_id).not.toBe(cycleId);
    expect((await data<Catalog>(await call('/catalog'))).cycles.find(c=>c.id===next.cycle_id)?.rough_date).toBe('2040-04-04');
  });
  it('permits off-turn completion without requiring admin',async()=>{
    await call('/sessions/demo-2','DELETE');
    local.sqlite.exec('UPDATE club_rotation SET nominal_slot=2,version=version+1');
    const b=await builder();const input={revision:0,event_date:'2000-01-01',cycle_id:'demo-cycle-a',cycle_slot:2,complete_turn:true,turn_version:1};
    const s=await data<Session>(await call(`/builders/${b.id}/publish`,'POST',{...input}));expect(s).toMatchObject({host_member_id:'member-1',cycle_slot:2});expect((await turn()).nominal_slot).toBe(3);
  });
  it('concurrent completion advances once and preserves the losing Builder',async()=>{
    await call('/sessions/demo-classics','DELETE');
    const a=await builder(),b=await builder(2);const input={revision:0,event_date:'2030-01-01',cycle_id:'demo-cycle-a',cycle_slot:5,complete_turn:true,turn_version:0};
    const responses=await Promise.all([call(`/builders/${a.id}/publish`,'POST',input),call(`/builders/${b.id}/publish`,'POST',input,2)]);expect(responses.map(r=>r.status).sort()).toEqual([201,409]);expect((await turn()).version).toBe(1);expect(local.sqlite.prepare('SELECT count(*) n FROM builder_sets').get()?.n).toBe(1);
  });
  it('rejects new cycles from later slots and invalid anchors; new exact dates preserve anchors',async()=>{
    await call('/sessions/demo-2','DELETE'); await call('/sessions/demo-classics','DELETE');
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
    const later=await data<Session>(await session({event_date:'2099-01-01',cycle_id:'demo-cycle-a',cycle_slot:3},3));
    await call('/sessions/demo-classics','DELETE');
    const input={event_date:'2027-02-03',kind:'hosted',host_member_id:'member-1',cycle_id:'demo-cycle-a',cycle_slot:1,movie_ids:['arrival']};
    expect((await call('/sessions/demo-1','PUT',input)).status).toBe(422);
    expect((await call('/sessions/demo-1','PUT',{...input,correct_anchor:true})).status).toBe(200);
    const catalog=await data<Catalog>(await call('/catalog'));
    expect(catalog.cycles[0].rough_date).toBe(input.event_date);expect(catalog.sessions.find(s=>s.id==='demo-2')?.event_date).toBe(input.event_date);expect(catalog.sessions.find(s=>s.id===later.id)?.event_date).toBe('2099-01-01');expect(await turn()).toEqual(before);
    expect(await data<HistoryAudit[]>(await call('/sessions/demo-2/audit'))).toHaveLength(1);
    await call('/sessions/demo-classics/restore','POST',undefined,2);
    expect((await data<Session>(await call('/sessions/demo-classics'))).event_date).toBe(input.event_date);expect(await turn()).toEqual(before);
  });
  it('anchor correction rolls back on failure and later-slot edits cannot change anchors',async()=>{
    local.sqlite.exec("CREATE TRIGGER fail_anchor_edit BEFORE UPDATE ON sessions WHEN NEW.id='demo-1' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
    const input={event_date:'2027-02-03',kind:'hosted',host_member_id:'member-1',cycle_id:'demo-cycle-a',cycle_slot:1,movie_ids:['arrival'],correct_anchor:true};
    expect((await call('/sessions/demo-1','PUT',input)).status).toBe(500);
    expect(local.sqlite.prepare('SELECT rough_date FROM cycles').get()?.rough_date).toBe('2026-09-19');expect(local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n).toBe(0);
    expect((await call('/sessions/demo-2','PUT',{...input,host_member_id:'member-2',cycle_slot:2,date_precision:'exact'})).status).toBe(200);
    expect(local.sqlite.prepare('SELECT rough_date FROM cycles').get()?.rough_date).toBe('2026-09-19');
  });
  it('audits edits/deletes, hides deleted events/appearances, preserves rotation and restricts restore',async()=>{
    const s=await data<Session>(await session());const before=await turn();await call(`/sessions/${s.id}`,'PUT',{event_date:'2000-01-01',kind:'hosted',host_member_id:'member-3',movie_ids:['arrival','moon']},4);
    expect((await call(`/sessions/${s.id}`,'DELETE',undefined,4)).status).toBe(200);expect((await call(`/sessions/${s.id}`)).status).toBe(404);expect((await data<Catalog>(await call('/catalog'))).sessions.some(x=>x.id===s.id)).toBe(false);
    const detail=await data<{appearances:{id:string}[]}>(await call('/movies/moon'));expect(detail.appearances.some(a=>a.id===s.id)).toBe(false);expect(await turn()).toEqual(before);
    expect((await call(`/sessions/${s.id}/restore`,'POST')).status).toBe(403);expect((await call(`/sessions/${s.id}/restore`,'POST',undefined,2)).status).toBe(200);expect((await call(`/sessions/${s.id}`)).status).toBe(200);
    const audit=await data<HistoryAudit[]>(await call(`/sessions/${s.id}/audit`));expect(audit.map(a=>a.action).sort()).toEqual(['create','delete','edit','restore']);expect(audit.find(a=>a.action==='edit')?.actor_member_id).toBe('member-4');expect(await turn()).toEqual(before);
    expect(()=>local.sqlite.exec(`UPDATE sessions SET planned_at='changed' WHERE id='${s.id}'`)).toThrow('IMMUTABLE_PUBLICATION');
  });
  it('all new routes require authentication; local bypass never impersonates an owner or admin',async()=>{
    const protectedRoutes=[['/avatars','GET'],['/auth/avatar','POST'],['/rotation','GET'],['/rotation/swap','POST'],['/builders','GET'],['/builders/x','DELETE'],['/builders/x/publish','POST'],['/sessions/x/audit','GET'],['/sessions/x/restore','POST']];
    const db=env.DB;env.DB={} as D1Database;for(const [path,method] of protectedRoutes) expect((await worker.fetch(new Request(`http://api/api/v1${path}`,{method}),env)).status).toBe(401);
    env.DB=db;env.LOCAL_WRITE_BYPASS='true';for(const [path,method] of protectedRoutes.filter(([p,m])=>!(p==='/rotation'&&m==='GET')&&!p.endsWith('/audit'))) expect((await call(path,method,method==='GET'?undefined:{})).status).toBe(401);
  });
});

it('Seen writes and Undo are personal even for admins',async()=>{ local.sqlite.exec("DELETE FROM seen_states WHERE movie_id='arrival'"); expect((await call('/movies/arrival/seen/member-1','PUT',{seen:true},2)).status).toBe(403); await data(await call('/movies/arrival/seen/member-2','PUT',{seen:true},2)); expect(local.sqlite.prepare("SELECT member_id,seen FROM seen_states WHERE movie_id='arrival'").all()).toEqual([{member_id:'member-2',seen:1}]); await data(await call('/movies/arrival/seen/member-1','PUT',{seen:false},1)); await data(await call('/movies/arrival/seen/member-2','PUT',{seen:null},2)); expect(local.sqlite.prepare("SELECT member_id,seen FROM seen_states WHERE movie_id='arrival'").all()).toEqual([{member_id:'member-1',seen:0}]); });
