import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ImportError } from './io.ts';
import { validateResolved, preflight, applyArchive } from './apply.ts';
import type { ResolvedPlan } from './model.ts';
import { Repository } from '../../worker/src/repository.ts';
import { calculateMetrics } from '../../shared/metrics.ts';
import { sortClassics } from '../../shared/ranking.ts';

export const capture = '2026-10-04T06:53:20Z';
export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export interface Target { database_name: string; database_id: string }
export interface Gates { mode?: string; databaseName?: string; databaseId?: string; planHash?: string; confirmation?: string }
export function productionTarget(config: {vars?: Record<string,string>; d1_databases?: (Target & {binding:string})[]}): Target {
  const db = config.d1_databases?.find(d=>d.binding==='DB');
  if (config.vars?.APP_ENV!=='production'||config.vars?.LOCAL_WRITE_BYPASS!=='false'||db?.database_name!=='bookclub-prod'||!db.database_id) throw new ImportError('Unsafe production configuration.');
  return {database_name:db.database_name,database_id:db.database_id};
}
export function guard(g: Gates, target: Target, bytes: Buffer, config: unknown) {
  if(g.mode!=='production')throw new ImportError('Explicit production mode required.');
  if(g.databaseName!==target.database_name)throw new ImportError('Production database name mismatch.');
  if(g.databaseId!==target.database_id)throw new ImportError('Production database ID mismatch.');
  if(g.confirmation!=='APPLY-BOOKCLUB-PRODUCTION')throw new ImportError('Production confirmation required.');
  if(!g.planHash||g.planHash!==sha256(bytes))throw new ImportError('Plan hash mismatch.');
  let input: unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ImportError('Invalid production plan.');}
  const plan=validateResolved(input,config);
  if(plan.snapshotCapturedAt!==capture)throw new ImportError('Production snapshot timestamp mismatch.');
  return plan;
}
const privateMember=z.object({id:z.string(),display_name:z.string().trim().min(1),authorized_email:z.email().refine(s=>s===s.trim().toLowerCase()),role:z.enum(['admin','member']),active:z.literal(1),sort_order:z.number().int(),google_sub:z.null(),avatar:z.null()}).strict();
export const bootstrapSchema=z.object({version:z.literal(1),members:z.array(privateMember).length(4),rotation:z.object({cycle_id:z.string().min(1),nominal_slot:z.literal(5),version:z.literal(0)}).strict()}).strict();
export type Bootstrap=z.infer<typeof bootstrapSchema>;
export function validateBootstrap(input:unknown):Bootstrap {
  const result=bootstrapSchema.safeParse(input);if(!result.success)throw new ImportError('Private member/rotation bootstrap invalid or incomplete.');
  const b=result.data;
  if(b.members.some((m,i)=>m.id!==`club-member-${i+1}`||m.sort_order!==i+1||m.role!==(i<2?'admin':'member'))||new Set(b.members.map(m=>m.authorized_email)).size!==4)throw new ImportError('Private bootstrap position, role or identity conflict.');
  return b;
}
// Inspect all conflicts before provisioning anything. Existing login/avatar state is
// never reset: this bootstrap is intentionally limited to the pre-launch boundary.
export async function memberPreflight(db:D1Database,b:Bootstrap) {
  const members=(await db.prepare('SELECT * FROM members').all<Record<string,unknown>>()).results;
  const auth=(await db.prepare('SELECT * FROM member_auth').all<Record<string,unknown>>()).results;
  if(members.some(m=>!b.members.some(w=>w.id===m.id))||auth.some(a=>!b.members.some(w=>w.id===a.member_id)))throw new ImportError('Member bootstrap conflict.');
  for(const m of b.members) {
    const old=members.find(r=>r.id===m.id),a=auth.find(r=>r.member_id===m.id);
    if(old&&['display_name','sort_order','active','role','avatar'].some(k=>old[k]!==m[k as keyof typeof m])||a&&(a.authorized_email!==m.authorized_email||a.google_sub!==null))throw new ImportError('Member bootstrap conflict.');
  }
  if((await db.prepare('SELECT count(*) n FROM auth_sessions').first<{n:number}>())?.n)throw new ImportError('Pre-launch auth sessions already exist.');
  return {members,auth};
}
export async function bootstrapMembers(db:D1Database,b:Bootstrap,execute=false) {
  const before=await memberPreflight(db,b), statements:D1PreparedStatement[]=[];
  for(const m of b.members) {
    if(!before.members.some(r=>r.id===m.id))statements.push(db.prepare('INSERT INTO members(id,display_name,sort_order,role,active,avatar) VALUES(?,?,?,?,?,NULL)').bind(m.id,m.display_name,m.sort_order,m.role,m.active));
    if(!before.auth.some(r=>r.member_id===m.id))statements.push(db.prepare('INSERT INTO member_auth(member_id,authorized_email,google_sub) VALUES(?,?,NULL)').bind(m.id,m.authorized_email));
  }
  if(execute&&statements.length)await db.batch(statements);
  return {pending:statements.length};
}
export async function rotationPreflight(db:D1Database,b:Bootstrap,plan:ResolvedPlan,requireCycle=true) {
  if(!plan.cycles.some(c=>c.id===b.rotation.cycle_id)||plan.events.some(e=>e.cycle_id===b.rotation.cycle_id&&e.cycle_slot===5))throw new ImportError('Bootstrap requires a reviewed unoccupied Classics slot.');
  if(requireCycle&&!await db.prepare('SELECT id FROM cycles WHERE id=?').bind(b.rotation.cycle_id).first())throw new ImportError('Rotation cycle missing.');
  if(await db.prepare('SELECT id FROM sessions WHERE cycle_id=? AND cycle_slot=5 AND deleted_at IS NULL').bind(b.rotation.cycle_id).first())throw new ImportError('Current Classics slot already occupied.');
  const old=await db.prepare('SELECT * FROM club_rotation').first<{id:number;cycle_id:string;nominal_slot:number;version:number}>();
  if(old&&(old.id!==1||old.cycle_id!==b.rotation.cycle_id||old.nominal_slot!==5||old.version!==0))throw new ImportError('Rotation version/state conflict.');
  return old;
}
export async function bootstrapRotation(db:D1Database,b:Bootstrap,plan:ResolvedPlan,execute=false) {
  const old=await rotationPreflight(db,b,plan);
  if(execute&&!old)await db.prepare('INSERT INTO club_rotation(id,cycle_id,nominal_slot,version) VALUES(1,?,5,0)').bind(b.rotation.cycle_id).run();
  return {pending:old?0:1,nominalSlot:5,open:true};
}
export interface BackupProof extends Target { path:string; capturedAt:string; planHash:string; exportHash:string; bytes:number; remote:true }
export function verifyBackup(proof:BackupProof|undefined,target:Target,planHash:string,bytes:Buffer) {
  if(!proof||proof.remote!==true||proof.database_name!==target.database_name||proof.database_id!==target.database_id||proof.planHash!==planHash||!proof.path||!Number.isFinite(Date.parse(proof.capturedAt))||Date.parse(proof.capturedAt)>Date.now()||proof.bytes!==bytes.length||bytes.length===0||proof.exportHash!==sha256(bytes))throw new ImportError('Verified remote backup proof required.');
}
export async function checkMigrations(db:D1Database,names:string[]) {
  const applied=(await db.prepare('SELECT name FROM d1_migrations').all<{name:string}>()).results;
  if(!names.includes('0008_provider_cooldowns.sql')||applied.length!==names.length||names.some(n=>applied.filter(a=>a.name===n).length!==1))throw new ImportError('Production migrations incomplete.');
}
export async function productionPreflight(db:D1Database,plan:ResolvedPlan,b:Bootstrap) {
  const members=await memberPreflight(db,b);
  await rotationPreflight(db,b,plan,false);
  // The shared immutable importer needs a complete positional roster. For an empty
  // DB, use a read-only view of the planned roster, without provisioning early.
  const view={prepare:(sql:string)=>sql==='SELECT id,display_name,sort_order,active FROM members'?{all:async()=>({results:b.members}),sql}:db.prepare(sql),
    batch:async(statements:D1PreparedStatement[])=>Promise.all(statements.map(s=>(s as unknown as {sql?:string}).sql==='SELECT id,display_name,sort_order,active FROM members'?Promise.resolve({results:b.members}):s.all()))} as unknown as D1Database;
  const result=await preflight(view,plan,'production');
  if(result.conflicts.length||(await db.prepare('PRAGMA foreign_key_check').all()).results.length)throw new ImportError('Production preflight conflicts or FK violations.');
  return {summary:result.summary,memberRows:members.members.length,pending:result.pending.length};
}
export async function importProduction(db:D1Database,plan:ResolvedPlan,b:Bootstrap) {
  await productionPreflight(db,plan,b);
  await bootstrapMembers(db,b,true);
  return applyArchive(db,plan,true,'production');
}
export async function verifyProduction(db:D1Database,plan:ResolvedPlan,b:Bootstrap,migrations:string[]) {
  await checkMigrations(db,migrations);
  const check=await productionPreflight(db,plan,b);
  if(check.pending||check.memberRows!==4)throw new ImportError('Production fingerprints/entities incomplete.');
  const auth=(await db.prepare('SELECT count(*) n FROM member_auth').first<{n:number}>())?.n;
  if(auth!==4||!await rotationPreflight(db,b,plan))throw new ImportError('Production auth/rotation bootstrap incomplete.');
  const counts=(await db.batch(['SELECT count(*) n FROM cycles WHERE import_source=?','SELECT count(*) n FROM sessions WHERE import_source=?','SELECT count(*) n FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.import_source=?'].map(sql=>db.prepare(sql).bind(plan.import_source)))).map(r=>(r.results[0] as {n:number}).n);
  if(counts[0]!==plan.cycles.length||counts[1]!==plan.events.length||counts[2]!==plan.events.reduce((n,e)=>n+e.films.length,0))throw new ImportError('Production history counts mismatch.');
  const catalog=await new Repository(db).catalog(),top=sortClassics(catalog.movies.filter(m=>m.classic)).filter(m=>m.ranking?.rankable&&m.ranking.eligible).slice(0,20).map(m=>m.title);
  if(JSON.stringify(top)!==JSON.stringify(plan.canonicalWatchOrder))throw new ImportError('Production Watch Order mismatch.');
  const metrics=calculateMetrics(catalog);
  if(metrics.events!==plan.events.length||metrics.appearances!==plan.events.reduce((n,e)=>n+e.films.length,0))throw new ImportError('Production History/Metrics derivation mismatch.');
  return {counts,historyLoads:true,metricsLoads:true,foreignKeyViolations:0,allFingerprintsPresent:true,authRows:auth,openClassicsSlot:5,catalogLoads:true,watchOrderMatches:true};
}
