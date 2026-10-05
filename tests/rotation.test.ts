import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import { ProductRepository } from '../worker/src/product-repository';
import { effectiveMember, swapTargets } from '../shared/rotation';
import { eventHost } from '../shared/event-host';
import type { Member, Viewer } from '../shared/types';
let local: ReturnType<typeof disposableD1>, repo: ProductRepository;
const actor: Viewer = {id:'member-2',display_name:'B',sort_order:2,avatar:null,role:'admin'};
const members: Member[] = [1,2,3,4].map(n => ({id:`member-${n}`,display_name:String(n),sort_order:n,active:1}));
beforeEach(() => {local=disposableD1();local.sqlite.exec(readFileSync('worker/seed.sql','utf8'));local.sqlite.exec('UPDATE club_rotation SET nominal_slot=1,cycle_id=NULL,version=version+1');repo=new ProductRepository(local.db);});
afterEach(() => local.sqlite.close());
const order = async () => {const turn=(await repo.rotation())!;return [1,2,3,4].map(slot=>effectiveMember(members,turn,slot)?.id);};
const swap = async (id='member-3') => repo.swapRotation(actor,{target_member_id:id,version:(await repo.rotation())!.version});
const complete = async () => {const turn=(await repo.rotation())!;return repo.saveSession({event_date:'2030-01-01',cycle_id:turn.cycle_id,cycle_slot:turn.nominal_slot,complete_turn:true,turn_version:turn.version,movie_ids:['moon']},actor);};
describe('current cycle swaps',() => {
 it('defaults to A B C D and swaps before a Cycle exists; completion resolves C B A D and next cycle resets',async () => {
  expect(await order()).toEqual(members.map(m=>m.id));
  const cycles=local.sqlite.prepare('SELECT count(*) n FROM cycles').get()?.n;
  await swap();expect(local.sqlite.prepare('SELECT count(*) n FROM cycles').get()?.n).toBe(cycles);
  expect(await order()).toEqual(['member-3','member-2','member-1','member-4']);
  expect(eventHost(members,await repo.rotation())).toEqual({kind:'hosted',host_member_id:'member-3'});
  const first=await complete();expect(local.sqlite.prepare('SELECT host_member_id FROM sessions WHERE id=?').get(first)?.host_member_id).toBe('member-3');
  expect(eventHost(members,await repo.rotation()).host_member_id).toBe('member-2');
  await complete();expect(eventHost(members,await repo.rotation()).host_member_id).toBe('member-1');
  await complete();await complete();expect((await repo.rotation())?.nominal_slot).toBe(5);
  await complete();expect(await repo.rotation()).toMatchObject({nominal_slot:1,cycle_id:null,human_order:{}});
  expect(await order()).toEqual(members.map(m=>m.id));await complete();expect(eventHost(members,await repo.rotation()).host_member_id).toBe('member-2');
 });
 it('supports repeated current/future exchanges without changing permanent order',async () => {
  await swap();await swap('member-4');expect(await order()).toEqual(['member-4','member-2','member-1','member-3']);
  expect(local.sqlite.prepare('SELECT id FROM members ORDER BY sort_order').all().map(m=>m.id)).toEqual(members.map(m=>m.id));
 });
 it('rejects CLSC, current, inactive, completed and already-recorded targets',async () => {
  await expect(swap('member-1')).rejects.toMatchObject({status:422});
  await expect(swap('clsc')).rejects.toMatchObject({status:422});
  local.sqlite.exec("UPDATE members SET active=0 WHERE id='member-3'");await expect(swap()).rejects.toMatchObject({status:422});
  local.sqlite.exec("UPDATE members SET active=1 WHERE id='member-3'");await complete();await expect(swap('member-1')).rejects.toMatchObject({status:422});
  const turn=(await repo.rotation())!;
  local.sqlite.prepare("INSERT INTO sessions(id,event_date,host_member_id,cycle_id,cycle_slot) VALUES('recorded','2030-01-01','member-3',?,4)").run(turn.cycle_id);
  await expect(swap()).rejects.toMatchObject({status:422});await expect(swap('member-4')).rejects.toMatchObject({status:422});
  local.sqlite.exec('UPDATE club_rotation SET nominal_slot=5,version=version+1');await expect(swap()).rejects.toMatchObject({status:422});
  expect(swapTargets(members,(await repo.rotation())!,[])).toEqual([]);
 });
 it('rejects stale versions and concurrent swaps atomically',async () => {
  const version=(await repo.rotation())!.version;await swap();await expect(repo.swapRotation(actor,{target_member_id:'member-4',version})).rejects.toMatchObject({status:409});
  const results=await Promise.allSettled([swap('member-2'),swap('member-4')]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
 });
 it.each(['event','inactive','completion'])('rejects %s raced between preflight and swap transaction',async mode => {
  await complete();const turn=(await repo.rotation())!;const batch=local.db.batch.bind(local.db);
  local.db.batch=(async statements => {
   if(mode==='event') local.sqlite.prepare("INSERT INTO sessions(id,event_date,host_member_id,cycle_id,cycle_slot) VALUES('race','2030-01-01','member-3',?,3)").run(turn.cycle_id);
   if(mode==='inactive') local.sqlite.exec("UPDATE members SET active=0 WHERE id='member-3'");
   if(mode==='completion') local.sqlite.exec('UPDATE club_rotation SET nominal_slot=3,version=version+1');
   return batch(statements);
  }) as D1Database['batch'];
  await expect(swap()).rejects.toMatchObject({status:409});expect((await repo.rotation())!.human_order).toEqual({});
  expect(local.sqlite.prepare("SELECT count(*) n FROM history_audit WHERE action='rotation'").get()?.n).toBe(0);
 });
 it('historical editing preserves the stored host after further swaps',async () => {
  await swap();const id=await complete();await swap('member-4');
  await repo.saveSession({event_date:'2030-01-01',host_member_id:'member-2',kind:'classics',movie_ids:['arrival']},actor,id);
  expect(local.sqlite.prepare('SELECT kind,host_member_id FROM sessions WHERE id=?').get(id)).toMatchObject({kind:'hosted',host_member_id:'member-3'});
  expect(eventHost(members,await repo.rotation(),{kind:'hosted',host_member_id:'member-3'})).toEqual({kind:'hosted',host_member_id:'member-3'});
 });
});
