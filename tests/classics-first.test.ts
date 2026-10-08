import { beforeEach,afterEach,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import { ProductRepository } from '../worker/src/product-repository';
import { canSwapClassics,effectiveMember,isClassicsTurn,swapTargets } from '../shared/rotation';
import { eventHost } from '../shared/event-host';
import { clubTimeline } from '../shared/metrics-summary';
import { cycleHostSequence } from '../shared/history-order';
import type { Catalog,Member,Session,Viewer } from '../shared/types';
let local:ReturnType<typeof disposableD1>,repo:ProductRepository;
const members:Member[]=[1,2,3,4].map(n=>({id:`member-${n}`,display_name:['Sean','Troy','Matt','Jess'][n-1],active:1,sort_order:n}));
const actor:Viewer={...members[1],avatar:null,role:'admin'};
beforeEach(()=>{local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');repo=new ProductRepository(local.db);});
afterEach(()=>local.sqlite.close());
const swap=async()=>repo.swapRotation(actor,{target_kind:'classics',version:(await repo.rotation())!.version});
const finish=async(date='2030-01-01')=>{const r=(await repo.rotation())!;return repo.saveSession({event_date:date,movie_ids:['moon','arrival','moon'],cycle_id:r.cycle_id,cycle_slot:r.nominal_slot,complete_turn:true,turn_version:r.version},actor);};
it('exchanges Sean and the upcoming Classics, anchors the first event and closes only at position five',async()=>{
 const past=local.sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),order=local.sqlite.prepare('SELECT id,sort_order FROM members ORDER BY id').all();
 await swap();const r=(await repo.rotation())!;
 expect([1,2,3,4,5].map(slot=>isClassicsTurn(r,slot)?'Classics':effectiveMember(members,r,slot)?.display_name)).toEqual(['Classics','Troy','Matt','Jess','Sean']);
 expect(r.human_order).toEqual({});expect(swapTargets(members,r,[])).toEqual([]);
 expect(eventHost(members,r)).toEqual({kind:'classics',host_member_id:null});
 const ids:string[]=[];for(let i=1;i<=5;i++){
  const expected=i===1?{kind:'classics',host_member_id:null}:{kind:'hosted',host_member_id:`member-${i===5?1:i}`};
  expect(eventHost(members,await repo.rotation())).toEqual(expected);
  ids.push(await finish(`2030-01-0${i}`));expect(local.sqlite.prepare('SELECT kind,host_member_id,cycle_slot FROM sessions WHERE id=?').get(ids.at(-1)!)).toMatchObject({...expected,cycle_slot:i});
  if(i<5)expect(await repo.rotation()).toMatchObject({nominal_slot:i+1,classics_first:1});
 }
 const cycle=local.sqlite.prepare('SELECT * FROM cycles WHERE id=(SELECT cycle_id FROM sessions WHERE id=?)').get(ids[0])!;
 expect(cycle).toMatchObject({rough_date:'2030-01-01',classics_first:1});
 expect(await repo.rotation()).toMatchObject({nominal_slot:1,cycle_id:null,classics_first:0,human_order:{}});
 expect(eventHost(members,await repo.rotation())).toEqual({kind:'hosted',host_member_id:'member-1'});
 expect(local.sqlite.prepare('SELECT id,sort_order FROM members ORDER BY id').all()).toEqual(order);
 expect(local.sqlite.prepare('SELECT * FROM sessions WHERE id NOT IN ('+ids.map(()=>'?').join(',')+') ORDER BY id').all(...ids)).toEqual(past);
 expect(local.sqlite.prepare('SELECT movie_id FROM session_movies WHERE session_id=? ORDER BY position').all(ids[0]).map(r=>r.movie_id)).toEqual(['moon','arrival','moon']);
 expect(local.sqlite.prepare("SELECT count(*) n FROM seen_states WHERE movie_id='moon' AND seen=1").get()?.n).toBe(4);
 const sessions=local.sqlite.prepare('SELECT * FROM sessions WHERE cycle_id=? ORDER BY cycle_slot').all(cycle.id) as unknown as Session[];
 const catalog={members,movies:[],cycles:[cycle],sessions:sessions.map(s=>({...s,movies:[]}))} as unknown as Catalog;
 expect(cycleHostSequence(catalog,String(cycle.id)).map(h=>h.label)).toEqual(['Classics','Troy','Matt','Jess','Sean']);
 expect(clubTimeline({...catalog,sessions:catalog.sessions.slice(0,1)},new Date('2030-01-01')).cyclesCompleted).toBe(Number(cycle.ordinal)-1);
 expect(clubTimeline(catalog,new Date('2030-01-05')).cyclesCompleted).toBe(cycle.ordinal);
 await finish('2030-02-01');expect(await repo.rotation()).toMatchObject({nominal_slot:2,classics_first:0});
});
it('offers Classics only for the untouched first effective Sean turn and requires an administrator',async()=>{
 const r=(await repo.rotation())!;expect(canSwapClassics(members,r,[])).toBe(true);
 expect(canSwapClassics(members,{...r,human_order:{1:'member-3',3:'member-1'}},[])).toBe(false);
 expect(canSwapClassics(members,r,[{cycle_id:null,deleted_at:null,completed_turn_version:r.version}])).toBe(false);
 await expect(repo.swapRotation({...actor,role:'member'},{target_kind:'classics',version:r.version})).rejects.toMatchObject({status:403});
 await repo.swapRotation(actor,{target_member_id:'member-3',version:r.version});await expect(swap()).rejects.toMatchObject({status:422});
});
it('rejects Classics after a cycle has started, and preserves future human exchanges while keeping final Sean protected',async()=>{
 await swap();await finish();await expect(swap()).rejects.toMatchObject({status:422});
 expect(swapTargets(members,(await repo.rotation())!,[]).map(t=>t.slot)).toEqual([3,4]);
 await expect(repo.swapRotation(actor,{target_member_id:'member-1',version:(await repo.rotation())!.version})).rejects.toMatchObject({status:422});
 await repo.swapRotation(actor,{target_member_id:'member-4',version:(await repo.rotation())!.version});
 expect(eventHost(members,await repo.rotation())).toEqual({kind:'hosted',host_member_id:'member-4'});
 await finish();await finish();await finish();expect(eventHost(members,await repo.rotation())).toEqual({kind:'hosted',host_member_id:'member-1'});await finish();
 expect(await repo.rotation()).toMatchObject({classics_first:0,nominal_slot:1});
});
it.each(['stale','concurrent','inactive','event','audit'])('rejects %s conflicts without partial swap/audit updates',async mode=>{
 const r=(await repo.rotation())!,audit=local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n;
 if(mode==='stale')await expect(repo.swapRotation(actor,{target_kind:'classics',version:r.version-1})).rejects.toMatchObject({status:409});
 else if(mode==='concurrent'){
  const results=await Promise.allSettled([swap(),swap()]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});return;
 }else{
  const batch=local.db.batch.bind(local.db);local.db.batch=(async statements=>{
   if(mode==='inactive')local.sqlite.exec("UPDATE members SET active=0 WHERE sort_order=1");
   if(mode==='event')await finish();
   if(mode==='audit')local.sqlite.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON history_audit WHEN NEW.action='rotation' BEGIN SELECT RAISE(ABORT,'HISTORY_CONFLICT'); END");
   local.db.batch=batch;return batch(statements);
  }) as D1Database['batch'];
  // Avoid recursive interception when recording the raced completed event.
  if(mode==='event'){
   local.db.batch=(async statements=>{local.db.batch=batch;await finish();return batch(statements);}) as D1Database['batch'];
  }
  await expect(swap()).rejects.toMatchObject({status:409});
 }
 expect((await repo.rotation())!.classics_first).toBe(0);
 expect(local.sqlite.prepare("SELECT count(*) n FROM history_audit WHERE action='rotation'").get()?.n).toBe(0);
 if(mode!=='event')expect(local.sqlite.prepare('SELECT count(*) n FROM history_audit').get()?.n).toBe(audit);
});
it('Builder publication uses hostless first and hosted last identities, retaining order and revision guards',async()=>{
 await swap();let r=(await repo.rotation())!;
 const first=await repo.saveBuilder(actor.id,{movie_ids:['arrival','moon','arrival']});
 const id=await repo.publishBuilder(actor,first.id,first.revision,{event_date:'2030-01-01',movie_ids:[],cycle_id:r.cycle_id,cycle_slot:1,complete_turn:true,turn_version:r.version});
 expect(local.sqlite.prepare('SELECT kind,host_member_id FROM sessions WHERE id=?').get(id)).toMatchObject({kind:'classics',host_member_id:null});
 expect(await repo.builders(actor.id)).toEqual([]);await finish();await finish();await finish();r=(await repo.rotation())!;
 const sean={...members[0],avatar:null,role:'member' as const},last=await repo.saveBuilder(sean.id,{movie_ids:['moon']});
 await expect(repo.publishBuilder(sean,last.id,last.revision+1,{event_date:'2030-01-05',movie_ids:[],cycle_id:r.cycle_id,cycle_slot:5,complete_turn:true,turn_version:r.version})).rejects.toMatchObject({status:409});
 const final=await repo.publishBuilder(sean,last.id,last.revision,{event_date:'2030-01-05',movie_ids:[],cycle_id:r.cycle_id,cycle_slot:5,complete_turn:true,turn_version:r.version});
 expect(local.sqlite.prepare('SELECT kind,host_member_id FROM sessions WHERE id=?').get(final)).toMatchObject({kind:'hosted',host_member_id:'member-1'});expect(await repo.rotation()).toMatchObject({nominal_slot:1,classics_first:0});
});
it('anchors corrections to Classics first, preserving later exact Sean dates and immutable cycle identity',async()=>{
 await swap();const first=await finish();await finish();await finish();await finish();const last=await finish('2030-01-20');
 const cycleId=local.sqlite.prepare('SELECT cycle_id FROM sessions WHERE id=?').get(first)!.cycle_id;
 await expect(repo.saveSession({event_date:'2030-01-02',movie_ids:['moon'],cycle_id:String(cycleId),cycle_slot:1},actor,first)).rejects.toMatchObject({code:'INVALID_ANCHOR'});
 await repo.saveSession({event_date:'2030-01-02',movie_ids:['moon'],cycle_id:String(cycleId),cycle_slot:1,correct_anchor:true},actor,first);
 expect(local.sqlite.prepare('SELECT rough_date FROM cycles WHERE id=?').get(cycleId)?.rough_date).toBe('2030-01-02');
 expect(local.sqlite.prepare('SELECT event_date FROM sessions WHERE id=?').get(last)?.event_date).toBe('2030-01-20');
 expect(()=>local.sqlite.prepare('UPDATE cycles SET classics_first=0 WHERE id=?').run(cycleId)).toThrow('HISTORY_CONFLICT');
});
it('upgrades populated 0018 without changing existing data, and fails closed before the migration',async()=>{
 const old=disposableD1('0018_au_watch_offers.sql');try{
  old.sqlite.exec(readFileSync('worker/seed.sql','utf8'));old.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');const repository=new ProductRepository(old.db);
  const sessions=old.sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),cycles=old.sqlite.prepare('SELECT * FROM cycles ORDER BY id').all();
  await expect(repository.swapRotation(actor,{target_kind:'classics',version:(await repository.rotation())!.version})).rejects.toMatchObject({status:503,code:'SCHEMA_UPGRADE_REQUIRED'});
  await repository.swapRotation(actor,{target_member_id:'member-3',version:(await repository.rotation())!.version});
  old.sqlite.exec(readFileSync('worker/migrations/0019_classics_first.sql','utf8'));
  expect(old.sqlite.prepare('SELECT * FROM sessions ORDER BY id').all()).toEqual(sessions);
  expect(old.sqlite.prepare('SELECT * FROM cycles ORDER BY id').all()).toEqual(cycles.map(c=>({...c,classics_first:0})));
  expect(old.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 }finally{old.sqlite.close();}
});
