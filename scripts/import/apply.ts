import { createHash } from 'node:crypto';
import { parseModel, resolvedPlanSchema, type ResolvedPlan } from './model.ts';
import { configSchema } from './workbook.ts';
import { ImportError } from './io.ts';
import { stableId } from './resolution.ts';
import { Repository } from '../../worker/src/repository.ts';
type Row=Record<string,string|number|null>;
type Spec={table:string;key:Row;row:Row;group:string};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a:Row,b:Row)=>Object.entries(b).every(([key,value])=>a[key]===value);
const tables=['movies','movie_import_refs','movie_external_ids','cycles','sessions','session_movies','classics','source_scores','seen_states','seen_import_observations'] as const;
export function validateResolved(input:unknown,configInput:unknown):ResolvedPlan {
  const plan=parseModel(resolvedPlanSchema,input,'Resolved plan'), config=parseModel(configSchema,configInput,'Config');
  if(!config.snapshotCapturedAt) throw new ImportError('Local apply requires explicit snapshotCapturedAt in the private config (archive observation time).');
  if(plan.snapshotCapturedAt!==config.snapshotCapturedAt||plan.import_source!==config.importSource||JSON.stringify(plan.members)!==JSON.stringify(config.memberIds)) throw new ImportError('Resolved plan and config do not match; rerun resolution with this config.');
  if(plan.members.some((id,i)=>id!==`club-member-${i+1}`)) throw new ImportError('Import preview requires the four confirmed club-member-1 through club-member-4 IDs in positional order.');
  if(plan.issues.some(i=>i.severity==='blocker')||plan.movies.some(m=>m.identity_status==='ambiguous')) throw new ImportError('Reconciliation blockers remain; local apply refused.');
  const unique=(values:unknown[],label:string)=>{if(new Set(values).size!==values.length)throw new ImportError(`Resolved plan validation failed: duplicate ${label}.`);};
  unique(plan.movies.map(m=>m.id),'movie IDs');unique(plan.movies.flatMap(m=>m.source_refs),'import references');unique(plan.movies.flatMap(m=>m.external_ids.map(e=>`${e.provider}:${e.external_id}`)),'external IDs');
  unique(plan.cycles.map(c=>c.id),'cycle IDs');unique(plan.cycles.map(c=>c.ordinal),'cycle ordinals');unique(plan.cycles.map(c=>c.import_key),'cycle import keys');unique(plan.events.map(e=>e.id),'event IDs');unique(plan.events.map(e=>e.import_key),'event import keys');unique(plan.classics.map(c=>c.movie_id),'membership');unique(plan.classics.map(c=>c.rank_seed),'rank seeds');
  const movies=new Map(plan.movies.map(m=>[m.id,m]));
  for(const m of plan.movies) unique(m.external_ids.map(e=>e.provider),'movie provider IDs');
  for(const e of plan.events) {
    if(!plan.cycles.some(c=>c.id===e.cycle_id)||e.kind==='hosted'&&!plan.members.includes(e.host_member_id??'')||e.kind==='classics'&&e.host_member_id!==null) throw new ImportError('Event foreign-key/member validation failed.');
    for(const [i,f] of e.films.entries()) if(f.position!==i+1||!movies.get(f.movie_id)?.source_refs.includes(`Tracker:${f.source_row}:${f.source_column}`)) throw new ImportError('Event film reference/order validation failed.');
  }
  for(const c of plan.classics) {
    const m=movies.get(c.movie_id);if(!m||c.source_refs.some(r=>!m.source_refs.includes(r)||!r.startsWith('Should Watch:'))||c.rank_seed!==Math.min(...c.source_refs.map(r=>Number(r.split(':')[1])))) throw new ImportError('Classics source/rank-seed validation failed.');
    unique(c.scores.map(s=>s.import_key),'score import keys');unique(c.seen.map(s=>s.member_id),'Seen member answers');
    for(const s of c.scores) if(s.fetched_at!==plan.snapshotCapturedAt||!s.source_ref||!c.source_refs.includes(s.source_ref)||s.source_ordinal!==Number(s.source_ref.split(':')[1])||s.import_key!==`${s.source_ref}:${s.provider}:${s.metric}`) throw new ImportError('Score capture/provenance validation failed.');
    for(const s of c.seen) if(!plan.members.includes(s.member_id)||s.updated_at!==plan.snapshotCapturedAt||s.source_refs?.some(r=>!c.source_refs.includes(r))) throw new ImportError('Seen member/capture validation failed.');
    unique(c.seen_observations.map(s=>`${s.source_ref}:${s.member_id}`),'Seen source observations');
    for(const s of c.seen_observations)if(!c.source_refs.includes(s.source_ref)||!plan.members.includes(s.member_id)||s.observed_at!==plan.snapshotCapturedAt)throw new ImportError('Seen observation provenance validation failed.');
  }
  if(plan.sourceCandidateRows!==plan.classics.reduce((n,c)=>n+c.source_refs.length,0))throw new ImportError('Candidate source count validation failed.');
  return plan;
}
function specs(plan:ResolvedPlan):Spec[] {
  const list:Spec[]=[],add=(table:string,key:Row,row:Row,group:string)=>list.push({table,key,row:{...key,...row},group}),source=plan.import_source;
  for(const m of plan.movies) {
    add('movies',{id:m.id},{title:m.title,year:m.year,import_source:source,import_key:m.id},`movie:${m.id}`);
    for(const ref of m.source_refs) add('movie_import_refs',{import_source:source,source_ref:ref},{movie_id:m.id,source_ordinal:Number(ref.split(':')[1])},`movie:${m.id}`);
    for(const e of m.external_ids)add('movie_external_ids',{movie_id:m.id,provider:e.provider},{external_id:e.external_id},`movie:${m.id}`);
  }
  for(const c of plan.cycles)add('cycles',{id:c.id},{ordinal:c.ordinal,rough_date:c.rough_date,import_source:source,import_key:c.import_key},`cycle:${c.id}`);
  for(const e of plan.events) {
    add('sessions',{id:e.id},{cycle_id:e.cycle_id,event_date:e.event_date,date_precision:e.date_precision,kind:e.kind,host_member_id:e.host_member_id,cycle_slot:e.cycle_slot,import_source:source,import_key:e.import_key},`event:${e.id}`);
    for(const f of e.films)add('session_movies',{session_id:e.id,position:f.position},{movie_id:f.movie_id},`event:${e.id}`);
  }
  for(const c of plan.classics) {
    add('classics',{movie_id:c.movie_id},{rank_seed:c.rank_seed,source},`classic:${c.movie_id}`);
    for(const s of c.scores)add('source_scores',{id:stableId(source,s.import_key)},{movie_id:c.movie_id,provider:s.provider,metric:s.metric,raw_value:s.raw_value,raw_scale:s.raw_scale,normalized_value:s.normalized_value,vote_count:s.vote_count,fetched_at:s.fetched_at,import_source:source,import_key:s.import_key,retrieved_via:s.retrieved_via,upstream_updated_at:s.upstream_updated_at??null,source_ref:s.source_ref!,source_ordinal:s.source_ordinal!,legacy_preferred:s.legacy_preferred??0},`scores:${c.movie_id}`);
    for(const s of c.seen)add('seen_states',{movie_id:c.movie_id,member_id:s.member_id},{seen:s.seen,updated_at:s.updated_at},`seen:${c.movie_id}`);
    for(const s of c.seen_observations)add('seen_import_observations',{import_source:source,source_ref:s.source_ref,member_id:s.member_id},{movie_id:c.movie_id,seen:s.seen,observed_at:s.observed_at},`seen-evidence:${c.movie_id}`);
  }
  return list;
}
export async function preflight(db:D1Database,plan:ResolvedPlan) {
  const needed=[...tables,'import_applied_entities','members','classics_seed_allocations'];
  const schema=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>()).results;
  if(needed.some(n=>!schema.some(t=>t.name===n))) throw new ImportError('Schema compatibility failure: run import-preview migrations through 0004.');
  const columns=(await db.prepare('PRAGMA table_info(source_scores)').all<{name:string}>()).results;
  if(!columns.some(c=>c.name==='source_ordinal')||!columns.some(c=>c.name==='legacy_preferred')) throw new ImportError('Schema compatibility failure: score provenance columns missing.');
  const queries=[...tables.map(t=>db.prepare(`SELECT * FROM ${t}`)),db.prepare('SELECT id,display_name,sort_order,active FROM members'),db.prepare('SELECT * FROM import_applied_entities'),db.prepare('SELECT (SELECT COUNT(*) FROM member_auth)+(SELECT COUNT(*) FROM auth_sessions) n'),db.prepare('SELECT * FROM classics_seed_allocations')];
  const result=await db.batch(queries), rows=Object.fromEntries(tables.map((t,i)=>[t,result[i].results as Row[]]));
  const members=result[tables.length].results as Row[];
  if(members.length!==4||plan.members.some((id,i)=>!members.some(m=>m.id===id&&m.display_name===`Host ${i+1}`&&m.sort_order===i+1&&m.active===1))) throw new ImportError('Preview member mismatch: prepare the generic positional roster; no writes performed.');
  if((result[tables.length+2].results[0] as Row).n!==0)throw new ImportError('Preview contains auth identities; apply refused.');
  const ledger=result[tables.length+1].results as Row[],allocations=result[tables.length+3].results as Row[],wanted=specs(plan), pending:Spec[]=[], counts:Record<string,{create:number;reuse:number}>={}, conflicts:string[]=[];
  for(const s of wanted) {
    const key=JSON.stringify(s.key), fingerprint=hash(s.row), old=(rows[s.table]??[]).find(r=>same(r,s.key)), recorded=ledger.find(r=>r.import_source===plan.import_source&&r.entity_type===s.table&&r.import_key===key);
    const count=counts[s.table]??={create:0,reuse:0};counts[s.table]=count;
    if(recorded&&recorded.payload_hash!==fingerprint)conflicts.push('Previously imported payload differs.');
    if(recorded&&!old)conflicts.push('Previously imported entity is missing.');
    if(old&&!same(old,s.row))conflicts.push('Existing entity differs from resolved plan.');
    if(!old) {count.create++;pending.push(s);}else{count.reuse++;if(!recorded)pending.push(s);}
    if(s.table==='movie_external_ids'&&rows.movie_external_ids.some(r=>r.provider===s.row.provider&&r.external_id===s.row.external_id&&r.movie_id!==s.row.movie_id))conflicts.push('External ID already belongs to another movie.');
    if(s.table==='movie_import_refs'&&rows.movie_import_refs.some(r=>r.import_source===s.row.import_source&&r.source_ref===s.row.source_ref&&r.movie_id!==s.row.movie_id))conflicts.push('Source ref already belongs to another movie.');
    if(s.table==='classics'&&allocations.some(r=>r.rank_seed===s.row.rank_seed&&r.movie_id!==s.row.movie_id||r.movie_id===s.row.movie_id&&r.rank_seed!==s.row.rank_seed))conflicts.push('Stable rank seed conflicts with an existing allocation.');
    if(s.table==='cycles'&&rows.cycles.some(r=>r.ordinal===s.row.ordinal&&r.id!==s.row.id))conflicts.push('Cycle ordinal belongs to another cycle.');
    if(['movies','cycles','sessions','source_scores'].includes(s.table)&&(rows[s.table]??[]).some(r=>r.import_source===s.row.import_source&&r.import_key===s.row.import_key&&!same(r,s.key)))conflicts.push('Import key belongs to another entity.');
  }
  for(const entry of ledger.filter(r=>r.import_source===plan.import_source)) if(!wanted.some(s=>s.table===entry.entity_type&&JSON.stringify(s.key)===entry.import_key))conflicts.push('Rerun removes previously applied source entities.');
  for(const e of plan.events) if(rows.session_movies.some(r=>r.session_id===e.id&&!e.films.some(f=>f.position===r.position&&f.movie_id===r.movie_id)))conflicts.push('Existing event has extra or changed appearances.');
  const summary={localOnly:true,counts,appearances:plan.events.reduce((n,e)=>n+e.films.length,0),sourceCandidateRows:plan.sourceCandidateRows,canonicalClassics:plan.classics.length,duplicateRowsCollapsed:plan.sourceCandidateRows-plan.classics.length,provisionalIdentities:plan.movies.filter(m=>m.identity_status==='provisional').length,blockers:0,conflicts:conflicts.length,snapshotCapturedAt:plan.snapshotCapturedAt};
  return {summary,pending,rows,conflicts};
}
export async function applyLocal(db:D1Database,plan:ResolvedPlan,execute=false) {
  const before=await preflight(db,plan);
  if(!execute)return {preflight:before.summary,applied:false};
  if(before.conflicts.length)throw new ImportError(`Local apply conflict: ${before.conflicts.length} immutable-state differences; no writes performed.`);
  const groups=new Map<string,Spec[]>();for(const s of before.pending)groups.set(s.group,[...groups.get(s.group)??[],s]);
  if([...groups.values()].some(group=>group.length*2>100))throw new ImportError('Local import entity exceeds the 100-statement transaction bound; no writes performed.');
  // Dependency-ordered, bounded D1 transactions. Each event and its ordered joins commit together.
  for(const group of groups.values()) {
    const statements:D1PreparedStatement[]=[];
    for(const s of group) {
      if(!(before.rows[s.table]??[]).some(r=>same(r,s.key))) {
        const cols=Object.keys(s.row); statements.push(db.prepare(`INSERT INTO ${s.table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).bind(...cols.map(k=>s.row[k])));
      }
      statements.push(db.prepare('INSERT INTO import_applied_entities(import_source,entity_type,import_key,payload_hash) VALUES(?,?,?,?)').bind(plan.import_source,s.table,JSON.stringify(s.key),hash(s.row)));
    }
    if(statements.length>100)throw new ImportError('Local import entity exceeds the 100-statement transaction bound; split source evidence before retry.');
    try{await db.batch(statements);}catch{throw new ImportError('Local apply batch failed; earlier committed groups may remain. Rerun preflight to resume; sensitive database output suppressed.');}
  }
  const after=await preflight(db,plan);if(after.conflicts.length||after.pending.length)throw new ImportError('Post-apply verification failed; inspect private preview state.');
  const foreign=(await db.prepare('PRAGMA foreign_key_check').all()).results;if(foreign.length)throw new ImportError('Post-apply foreign-key verification failed.');
  const counts=(await db.batch([
    db.prepare('SELECT COUNT(*) n FROM cycles WHERE import_source=?').bind(plan.import_source),
    db.prepare('SELECT COUNT(*) n FROM sessions WHERE import_source=?').bind(plan.import_source),
    db.prepare('SELECT COUNT(*) n FROM session_movies JOIN sessions ON sessions.id=session_movies.session_id WHERE sessions.import_source=?').bind(plan.import_source),
  ])).map(r=>(r.results[0] as {n:number}).n);
  if(counts[0]!==plan.cycles.length||counts[1]!==plan.events.length||counts[2]!==after.summary.appearances)throw new ImportError('Imported cycle/event/appearance counts do not match the plan.');
  const catalog=await new Repository(db).catalog();
  return {preflight:before.summary,applied:true,verified:{cycles:counts[0],events:counts[1],appearances:counts[2],canonicalClassics:plan.classics.length,foreignKeyViolations:foreign.length,watchOrderDerives:catalog.movies.filter(m=>m.classic).every(m=>m.ranking!==null)}};
}
