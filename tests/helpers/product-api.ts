import { afterEach, beforeEach, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../../worker/src/index';
import { hashToken } from '../../worker/src/auth';

import { disposableD1 } from '../d1';

import type { BuilderSet, Rotation, Session, Viewer } from '../../shared/types';
import type { Env } from '../../worker/src/http';
export let local: ReturnType<typeof disposableD1>, env: Env;
export const tokens = ['1','2','3','4'].map(n => n.repeat(64));
export const call = (path: string,method='GET',input?: unknown,member=1) => worker.fetch(new Request(`http://api/api/v1${path}`,{method,headers: {Authorization: `Bearer ${tokens[member-1]}`},...(input === undefined ? {} : {body: JSON.stringify(input)})}),env);
export async function data<T>(response: Response): Promise<T> { expect(response.ok,await response.clone().text()).toBe(true); return (await response.json() as {data: T}).data; }
export const builder = (member=1,films=['arrival','moon']) => call('/builders','POST',{title:'Private idea',notes:'Only its owner sees this',movie_ids:films},member).then(data<BuilderSet>);
export const turn = () => call('/rotation').then(data<Rotation>);
export const viewer = (member=1) => call('/auth/me','GET',undefined,member).then(data<{viewer: Viewer}>).then(r=>r.viewer);
export const session = (input: Record<string,unknown>={},member=1) => call('/sessions','POST',{event_date:'2030-05-06',kind:'hosted',host_member_id:`member-${member}`,movie_ids:['moon'],...input},member);
export async function sessionData(response:Response):Promise<Session> { const result=await data<Session | import('../../shared/types').JournalMutationResult>(response); return 'session' in result ? result.session! : result as Session; }
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