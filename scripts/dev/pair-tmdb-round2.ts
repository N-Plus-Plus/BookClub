import { z } from 'zod';
import { createHash } from 'node:crypto';
import { Repository } from '../../worker/src/repository.ts';
import { MovieService } from '../../worker/src/services.ts';
import { TmdbProvider } from '../../worker/src/providers/tmdb.ts';
import { ProviderError } from '../../worker/src/providers/http.ts';
import type { Env } from '../../worker/src/http.ts';
import type { ProviderMovie } from '../../worker/src/providers/types.ts';
import { near, preflight } from './pair-tmdb.ts';
import { tmdbMetadataIsStale } from '../../shared/metadata.ts';
import { planMerge, applyMerge, mergeSummary, ensureMergeReceipts, relatedTables, receiptTable, receiptsExist, planRemoval, applyRemoval, removalTable, type Merge, type Row } from './tmdb-merge.ts';

const member=z.object({movie_id:z.string().min(1),title:z.string().min(1),source_refs:z.array(z.string().regex(/^(Tracker|Should Watch):/)).min(1)});
const tmdb=z.string().regex(/^[1-9]\d{0,9}$/);
const pairing=member.extend({action:z.enum(['pair','pair_or_merge_existing_owner']),tmdb_kind:z.literal('movie').optional(),tmdb_id:tmdb,confirmation:z.enum(['owner_confirmed','corrected_rejection']),strict_year:z.boolean(),expected_title:z.string().min(1).optional(),expected_year:z.number().int().min(1800).max(2200).optional()});
export function parseRound2(input:unknown) {
  const manifest=z.object({version:z.union([z.literal(2),z.literal(3)]),pairings:z.array(pairing),merge_into_existing:z.array(member.extend({action:z.literal('merge_into_existing_tmdb_owner'),tmdb_id:tmdb,confirmation:z.literal('round1_existing_owner_conflict')})).default([]),merge_groups:z.array(z.object({action:z.literal('merge_group_then_pair'),tmdb_id:tmdb,members:z.array(member).min(2),confirmation:z.literal('owner_confirmed')})),removals:z.array(member.extend({appearance_count:z.number().int().nonnegative(),classic:z.boolean(),action:z.literal('remove_from_active_catalogue'),confirmation:z.literal('owner_confirmed')})).optional()}).parse(input);
  const members=[...manifest.pairings,...manifest.merge_into_existing,...manifest.merge_groups.flatMap(g=>g.members),...(manifest.removals??[])];
  const ids=members.map(m=>m.movie_id),refs=members.flatMap(m=>m.source_refs),targets=[...manifest.pairings,...manifest.merge_into_existing,...manifest.merge_groups].map(o=>o.tmdb_id);
  if(new Set(ids).size!==ids.length||new Set(refs).size!==refs.length||new Set(targets).size!==targets.length)throw Error('Duplicate round-two operation, source ref or TMDB target.');
  if(manifest.pairings.some(p=>p.confirmation==='corrected_rejection'&&(!p.expected_title||p.expected_year===undefined)))throw Error('Corrected rejection requires expected title/year.');
  return manifest;
}
type Manifest=ReturnType<typeof parseRound2>;
export function round2Compatibility(p:Manifest['pairings'][number],m:ProviderMovie) {
  if(!m.external_ids.some(e=>e.provider==='tmdb'&&e.external_id===p.tmdb_id))return 'TMDB returned a different identity.';
  if(typeof m.title!=='string'||!m.title.trim())return 'TMDB did not return a usable film record.';
  if(p.confirmation==='owner_confirmed')return null;
  if(![m.title,m.original_title].some(t=>t&&near(t,p.expected_title!)))return 'Returned film contradicts corrected title.';
  if(p.strict_year&&(!Number.isInteger(m.year)||Math.abs(m.year!-p.expected_year!)>1))return 'Returned film contradicts corrected year.';
  return null;
}
const tables=['movies',...relatedTables,'import_applied_entities','history_audit'] as const;
export type Baseline=Record<string,Row[]>;
function preflightState(state:Baseline,p:{movie_id:string;source_refs:string[];tmdb_id:string}) {
  const movie=state.movies.find(m=>m.id===p.movie_id);
  if(!movie)return {reason:'movie_id does not exist.'};
  const refs=state.movie_import_refs.filter(r=>r.movie_id===p.movie_id);
  if(!movie.import_source||movie.import_key!==p.movie_id||refs.some(r=>r.import_source!==movie.import_source)||JSON.stringify(refs.map(r=>r.source_ref).sort())!==JSON.stringify([...p.source_refs].sort()))return {reason:'Stored provenance/source_refs differs from manifest.'};
  const ids=state.movie_external_ids.filter(e=>e.movie_id===p.movie_id),tmdb=ids.find(e=>e.provider==='tmdb');
  if(tmdb&&tmdb.external_id!==p.tmdb_id)return {reason:'Stored TMDB identity contradicts manifest.'};
  if(tmdb)return movie.tmdb_metadata_checked_at&&movie.tmdb_artwork_checked_at?{already:true}:{reason:'Attached identity has incomplete check state.'};
  if(ids.length)return {reason:'Existing external identity requires reconciliation.'};
  return {attachment:{import_source:String(movie.import_source),source_refs:p.source_refs}};
}
export async function captureBaseline(db:D1Database):Promise<Baseline> {
  const batches=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY rowid`)));
  const result:Baseline={};tables.forEach((t,i)=>{result[t]=batches[i].results as Row[];});
  return result;
}
type Entry=Record<string,unknown>;
export type Round2Report={manifest_hash:string;mode:string;proposed:number;accepted:Entry[];already_applied:Entry[];rejected:Entry[];conflicts:Entry[];provider_failures:Entry[];merge_into_existing_proposed:number;merge_groups_proposed:number;merges_completed:Entry[];merge_groups_completed:Entry[];already_applied_merges:Entry[];merge_conflicts:Entry[];canonical_rows_removed:string[];provider_calls:number;cooldown_events:number;starting_unidentified:number;ending_unidentified:number;starting_canonical:number;ending_canonical:number;remaining_without_tmdb:number;responses:Record<string,ProviderMovie>;verification:Record<string,unknown>;removals_completed?:Entry[];removal_conflicts?:Entry[];unresolved_titles?:string[]};
export type Round2Options={apply:boolean;token?:string;save:(r:Round2Report)=>Promise<void>;baseline?:Baseline;previous?:Round2Report;integrity?:()=>Promise<Record<string,unknown>[]>;progress?:(message:string)=>void};

export async function runRound2(db:D1Database,manifest:Manifest,options:Round2Options) {
  const manifestHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  if(options.previous&&options.previous.manifest_hash!==manifestHash)throw Error('Report belongs to a different manifest; choose a new ignored output directory.');
  const baseline=options.baseline??await captureBaseline(db),repo=new Repository(db);
  const startUnidentified=baseline.movies.length-baseline.movie_external_ids.filter(e=>e.provider==='tmdb').length;
  const report:Round2Report=options.previous??{manifest_hash:manifestHash,mode:options.apply?'apply':'preflight',proposed:manifest.pairings.length,accepted:[],already_applied:[],rejected:[],conflicts:[],provider_failures:[],merge_into_existing_proposed:manifest.merge_into_existing.length,merge_groups_proposed:manifest.merge_groups.length,merges_completed:[],merge_groups_completed:[],already_applied_merges:[],merge_conflicts:[],canonical_rows_removed:[],provider_calls:0,cooldown_events:0,starting_unidentified:startUnidentified,ending_unidentified:startUnidentified,starting_canonical:baseline.movies.length,ending_canonical:baseline.movies.length,remaining_without_tmdb:startUnidentified,responses:{},verification:{}};
  report.mode=options.apply?'apply':'preflight';
  report.conflicts=[];report.rejected=[];report.merge_conflicts=[];
  const entry=(p:{movie_id:string;title:string;tmdb_id:string},reason?:string)=>({movie_id:p.movie_id,title:p.title,tmdb_id:p.tmdb_id,...(reason?{reason}:{})});
  const automaticMerges:Merge[]=[];
  const state=manifest.version===3&&options.previous?await captureBaseline(db):baseline;
  const add=(list:Entry[],value:Entry,key='movie_id')=>{if(!list.some(r=>r[key]===value[key]))list.push(value);};
  let providerStopped=false;
  const details=async(id:string)=>{
    if(report.responses[id])return report.responses[id];
    if(providerStopped)throw Error('Provider processing paused.');
    const wait=await repo.providerCooldown('tmdb');
    if(wait!==null)throw new ProviderError('TMDB','rate_limited','TMDB cooldown active.',wait);
    if(!options.token)throw new ProviderError('TMDB','credentials','Local TMDB token is not configured.');
    report.provider_calls++;await options.save(report);
    const response=await new TmdbProvider(options.token).details(id);
    report.responses[id]=response;await options.save(report);return response;
  };
  const providerFailure=async(error:unknown,operation:Entry)=>{
    if(!(error instanceof ProviderError))return false;
    report.provider_failures.push({...operation,reason:error.message});
    if(error.kind==='rate_limited'){report.cooldown_events++;await repo.setProviderCooldown('tmdb',error.retryAfter??60);}
    if(error.kind!=='not_found')providerStopped=true;
    return true;
  };
  await options.save(report);
  for(const p of manifest.pairings){
    const owner=state.movie_external_ids.find(e=>e.provider==='tmdb'&&e.external_id===p.tmdb_id);
    if(manifest.version===3&&owner&&owner.movie_id!==p.movie_id){automaticMerges.push({tmdb_id:p.tmdb_id,members:[{movie_id:p.movie_id,title:p.title,source_refs:p.source_refs}],kind:'existing',owner_confirmed:true});continue;}
    const check=manifest.version===3?preflightState(state,p):await preflight(db,{...p,confidence:'high',matched_title:p.expected_title??p.title,matched_year:p.expected_year??2000});
    if(check.reason)report.conflicts.push(entry(p,check.reason));
    else if(check.already){if(!report.accepted.some(a=>a.movie_id===p.movie_id))add(report.already_applied,entry(p));}
    else if(options.apply&&!providerStopped){
      try{const response=await details(p.tmdb_id),reason=round2Compatibility(p,response);
        if(reason)report.rejected.push(entry(p,reason));
        else {await repo.enrichMetadata(p.movie_id,p.tmdb_id,response,check.attachment,manifest.version===3);add(report.accepted,entry(p));}
      }catch(error){if(!await providerFailure(error,entry(p)))report.conflicts.push(entry(p,error instanceof Error&&'code' in error?String((error as {code:unknown}).code):'Identity or local transaction conflict.'));}
    }
    await options.save(report);options.progress?.(`Pairing ${p.title} checked.`);
    if(options.apply&&manifest.version!==3)await new Promise(done=>setTimeout(done,100));
  }
  const ops:Merge[]=[...automaticMerges,...manifest.merge_into_existing.map(p=>({tmdb_id:p.tmdb_id,members:[{movie_id:p.movie_id,title:p.title,source_refs:p.source_refs}],kind:'existing' as const})),...manifest.merge_groups.map(g=>({tmdb_id:g.tmdb_id,members:g.members,kind:'group' as const}))];
  for(const op of ops){
    try{
      const plan=await planMerge(db,op,manifest.version===3?state:undefined);
      if(plan.already)add(report.already_applied_merges,mergeSummary(plan),'tmdb_id');
      else if(options.apply){
        const movie=manifest.version===3?state.movies.find(m=>m.id===plan.survivor)!:(await repo.catalog()).movies.find(m=>m.id===plan.survivor)!;
        const fresh=(manifest.version===3?state.movie_external_ids.some(e=>e.movie_id===plan.survivor&&e.provider==='tmdb'&&e.external_id===op.tmdb_id):(movie as import('../../shared/types').Movie).external_ids.some(e=>e.provider==='tmdb'&&e.external_id===op.tmdb_id))&&!tmdbMetadataIsStale(movie.tmdb_metadata_checked_at as string|null)&&!tmdbMetadataIsStale(movie.tmdb_artwork_checked_at as string|null);
        if(!fresh&&providerStopped)continue;
        const metadata=fresh?undefined:await details(op.tmdb_id);
        // Owner-confirmed groups deliberately do not use title/year heuristics.
        if(metadata&&(!metadata.title||!metadata.external_ids.some(e=>e.provider==='tmdb'&&e.external_id===op.tmdb_id)))throw Error('TMDB returned a contradictory film identity.');
        await ensureMergeReceipts(db);await applyMerge(db,plan,metadata,manifest.version===3);
        add(op.kind==='existing'?report.merges_completed:report.merge_groups_completed,mergeSummary(plan),'tmdb_id');
        for(const id of plan.removed)if(!report.canonical_rows_removed.includes(id))report.canonical_rows_removed.push(id);
      }
    }catch(error){const operation={source_movie_ids:op.members.map(m=>m.movie_id),supplied_titles:op.members.map(m=>m.title),survivor_movie_id:await repo.findExternal('tmdb',op.tmdb_id),tmdb_id:op.tmdb_id};if(!await providerFailure(error,operation))report.merge_conflicts.push({...operation,reason:error instanceof Error&&!('code' in error)?error.message:'Merge transaction rolled back.'});}
    await options.save(report);options.progress?.(`Merge target ${op.tmdb_id} checked.`);
  }
  report.removals_completed??=[];report.removal_conflicts=[];
  for(const removal of manifest.removals??[]){
    try{const plan=await planRemoval(db,removal,manifest.version===3?state:undefined);if(options.apply&&!plan.already){await applyRemoval(db,plan);add(report.removals_completed,{movie_id:removal.movie_id,title:removal.title});if(!report.canonical_rows_removed.includes(removal.movie_id))report.canonical_rows_removed.push(removal.movie_id);}}
    catch(error){report.removal_conflicts.push({movie_id:removal.movie_id,title:removal.title,reason:error instanceof Error?error.message:'Removal conflict.'});}
    await options.save(report);
  }
  const after=await captureBaseline(db),catalog=await repo.catalog();
  const removalExists=await db.prepare("SELECT name FROM sqlite_master WHERE name=?").bind(removalTable).first();
  const removalReceipts=removalExists?(await db.prepare(`SELECT * FROM ${removalTable}`).all<Row>()).results:[];
  const authorisedRemoved=new Set((manifest.removals??[]).filter(m=>!after.movies.some(r=>r.id===m.movie_id)&&removalReceipts.some(r=>r.source_movie_id===m.movie_id)).map(m=>m.movie_id));
  const removalArchived=(table:string,row:Row)=>authorisedRemoved.has(String(row.movie_id??row.id))&&removalReceipts.some(r=>{const saved=JSON.parse(String(r.snapshot_json)) as Baseline;return saved[table]?.some(old=>Object.keys(row).every(k=>old[k]===row[k]));});
  const receipts=await receiptsExist(db)?(await db.prepare(`SELECT * FROM ${receiptTable}`).all<Row>()).results:[];
  const redirect=new Map(receipts.map(r=>[String(r.source_movie_id),String(r.survivor_movie_id)]));
  const mapId=(id:Row[string])=>{let key=String(id);const visited=new Set<string>();while(redirect.has(key)){if(visited.has(key))throw Error('Merge receipt cycle.');visited.add(key);key=redirect.get(key)!;}return key;};
  const equal=(a:Row,b:Row)=>Object.keys(a).every(k=>a[k]===b[k]);
  const preserved=(table:string)=>baseline[table].every(row=>removalArchived(table,row)||after[table].some(current=>equal({...row,...(row.movie_id?{movie_id:mapId(row.movie_id)}:{})},current)));
  const membershipPreserved=baseline.classics.every(c=>removalArchived('classics',c)||after.classics.some(a=>a.movie_id===mapId(c.movie_id)));
  const seenPreserved=baseline.seen_states.every(s=>removalArchived('seen_states',s)||after.seen_states.some(a=>a.movie_id===mapId(s.movie_id)&&a.member_id===s.member_id&&a.seen===s.seen&&String(a.updated_at)>=String(s.updated_at)));
  const identities=baseline.movie_external_ids.filter(e=>e.provider==='tmdb').every(e=>after.movie_external_ids.some(a=>a.movie_id===e.movie_id&&a.provider===e.provider&&a.external_id===e.external_id));
  const receiptEvidence=receipts.every(r=>{
    const snapshot=JSON.parse(String(r.snapshot_json)) as Baseline;
    return snapshot.movies.some(m=>m.id===r.source_movie_id)&&snapshot.movie_import_refs.filter(f=>f.movie_id===r.source_movie_id).every(f=>after.movie_import_refs.some(a=>a.movie_id===r.survivor_movie_id&&a.import_source===f.import_source&&a.source_ref===f.source_ref));
  });
  const archived=(table:string,row:Row)=>removalArchived(table,row)||receipts.some(r=>{
    const saved=JSON.parse(String(r.snapshot_json)) as Baseline;
    return saved[table]?.some(original=>equal(row,original));
  });
  const membershipStates=baseline.classics.every(c=>after.classics.some(a=>equal(c,a))||archived('classics',c));
  const allocationStates=baseline.classics_seed_allocations.every(c=>after.classics_seed_allocations.some(a=>equal(c,a))||archived('classics_seed_allocations',c));
  const removed=baseline.movies.filter(m=>!after.movies.some(a=>a.id===m.id));
  const collapseUnidentified=removed.filter(m=>!baseline.movie_external_ids.some(e=>e.movie_id===m.id&&e.provider==='tmdb')).length;
  const addedIdentities=after.movie_external_ids.filter(e=>e.provider==='tmdb'&&!baseline.movie_external_ids.some(b=>b.provider==='tmdb'&&b.external_id===e.external_id)).length;
  report.ending_canonical=after.movies.length;report.ending_unidentified=after.movies.length-after.movie_external_ids.filter(e=>e.provider==='tmdb').length;report.remaining_without_tmdb=report.ending_unidentified;
  const integrity=options.integrity?await options.integrity():(await db.prepare('PRAGMA integrity_check').all<Row>()).results;
  const fks=(await db.prepare('PRAGMA foreign_key_check').all()).results;
  const duplicates=(await db.prepare("SELECT external_id FROM movie_external_ids WHERE provider='tmdb' GROUP BY external_id HAVING count(*)>1").all()).results;
  let exposed=true;
  const service=new MovieService(repo,{DB:db} as Env);
  const targets=[...manifest.pairings,...manifest.merge_groups].map(p=>p.tmdb_id);
  for(const movie of catalog.movies.filter(m=>m.external_ids.some(e=>e.provider==='tmdb'&&targets.includes(e.external_id)))){const detail=manifest.version===3?movie:await service.detail(movie.id);if(!movie.tmdb_metadata_checked_at||!movie.tmdb_artwork_checked_at||JSON.stringify({...detail,appearances:undefined})!==JSON.stringify(movie))exposed=false;}
  report.verification={integrity,fks,duplicate_tmdb_ownership:duplicates,baseline_tmdb_identities_intact:identities,baseline_tmdb_identity_count:baseline.movie_external_ids.filter(e=>e.provider==='tmdb').length,event_positions_preserved:preserved('session_movies'),builder_positions_preserved:preserved('builder_movies'),classics_membership_preserved:membershipPreserved,original_classics_states_preserved:membershipStates,original_rank_allocations_preserved:allocationStates,score_observations_preserved:preserved('source_scores'),seen_observations_preserved:preserved('seen_import_observations'),effective_seen_preserved:seenPreserved,source_refs_preserved:preserved('movie_import_refs'),fingerprints_preserved:preserved('import_applied_entities'),audit_history_preserved:preserved('history_audit'),receipt_evidence_preserved:receiptEvidence,catalogue_detail_metadata_artwork:exposed,canonical_delta_correct:baseline.movies.length-after.movies.length===report.canonical_rows_removed.length&&removed.every(m=>report.canonical_rows_removed.includes(String(m.id))&&(receipts.some(r=>r.source_movie_id===m.id)||authorisedRemoved.has(String(m.id)))),unidentified_delta_correct:startUnidentified-report.ending_unidentified===collapseUnidentified+addedIdentities,unidentified_collapse:collapseUnidentified,new_tmdb_identities:addedIdentities,metadata_artwork_same_response:true};
  report.unresolved_titles=catalog.movies.filter(m=>!m.external_ids.some(e=>e.provider==='tmdb')).map(m=>m.title);
  report.verification.authorised_removals_gone=(manifest.removals??[]).every(m=>authorisedRemoved.has(m.movie_id))||!options.apply;
  await options.save(report);
  if(integrity.some(r=>Object.values(r)[0]!=='ok')||fks.length||duplicates.length||Object.values(report.verification).some(v=>v===false))throw Error('Round-two local integrity verification failed; inspect report.');
  return report;
}
