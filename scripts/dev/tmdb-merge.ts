import { createHash } from 'node:crypto';
import { Repository } from '../../worker/src/repository.ts';
import { near } from './pair-tmdb.ts';
import type { ProviderMovie } from '../../worker/src/providers/types.ts';

export type Member = {movie_id:string;title:string;source_refs:string[]};
export type Merge = {tmdb_id:string;members:Member[];kind:'existing'|'group';owner_confirmed?:true};
type Value = string|number|null;
export type Row = Record<string,Value>;
export const relatedTables=['movie_score_checks','movie_external_ids','movie_genres','movie_assets','session_movies','classics','seen_states','classics_seed_allocations','source_scores','movie_import_refs','seen_import_observations','builder_movies'] as const;
export const receiptTable='local_movie_merge_receipts';
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
const hash=(op:Merge)=>createHash('sha256').update(JSON.stringify({kind:op.kind,tmdb_id:op.tmdb_id,members:[...op.members].sort((a,b)=>a.movie_id.localeCompare(b.movie_id)).map(m=>({...m,source_refs:[...m.source_refs].sort()}))})).digest('hex');
export async function ensureMergeReceipts(db:D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${receiptTable} (
    source_movie_id TEXT PRIMARY KEY, survivor_movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL, operation_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    merged_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`).run();
}
export async function receiptsExist(db:D1Database) {return !!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(receiptTable).first();}
export async function discoverRelationships(db:D1Database) {
  // D1 denies foreign_key_list. Inspect actual CREATE SQL instead, failing closed
  // for unknown tables/columns or table-level movie foreign keys.
  const tables=(await db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string;sql:string}>()).results;
  for(const {name,sql} of tables){
    const columns=sql.slice(sql.indexOf('(')+1).split(',');
    for(const column of columns.filter(c=>/\bREFERENCES\s+["`\[]?movies\b/i.test(c))){
      const from=column.trim().match(/^["`\[]?([A-Za-z_]\w*)/i)?.[1];
      if(!((relatedTables as readonly string[]).includes(name)&&from==='movie_id')&&!(name===receiptTable&&from==='survivor_movie_id'))throw Error(`Unsupported movie relationship: ${name}.${from??'unknown'}.`);
    }
    if(columns.some(c=>/^\s*["`\[]?movie_id\b/i.test(c))&&!(relatedTables as readonly string[]).includes(name))throw Error(`Unsupported movie relationship: ${name}.`);
  }
}
export async function rowsFor(db:D1Database,table:string,ids:string[]) {
  return (await db.prepare(`SELECT * FROM ${quote(table)} WHERE ${table==='movies'?'id':'movie_id'} IN (${ids.map(()=>'?').join(',')}) ORDER BY rowid`).bind(...ids).all<Row>()).results;
}
export async function planMerge(db:D1Database,op:Merge,state?:Record<string,Row[]>) {
  await discoverRelationships(db);
  const repo=new Repository(db),owner=await repo.findExternal('tmdb',op.tmdb_id),operationHash=hash(op);
  if(op.kind==='existing'&&!owner)throw Error('Target TMDB ID has no current owner.');
  if(op.kind==='group'&&owner&&!op.members.some(m=>m.movie_id===owner))throw Error('TMDB ID belongs to a movie outside the confirmed group.');
  const hasReceipts=await receiptsExist(db);
  const receipts=hasReceipts?(await db.prepare(`SELECT * FROM ${receiptTable} WHERE operation_hash=?`).bind(operationHash).all<Row>()).results:[];
  const live=state?state.movies.filter(r=>op.members.some(m=>m.movie_id===r.id)):await rowsFor(db,'movies',op.members.map(m=>m.movie_id));
  const missing=op.members.filter(m=>!live.some(r=>r.id===m.movie_id));
  if(missing.length){
    if(!owner||missing.some(m=>!receipts.some(r=>r.source_movie_id===m.movie_id&&r.survivor_movie_id===owner&&r.tmdb_id===op.tmdb_id)))throw Error('Missing member has no matching durable merge receipt.');
    const survivors=new Set(receipts.map(r=>r.survivor_movie_id));
    if(survivors.size!==1||live.some(r=>r.id!==owner))throw Error('Incomplete or contradictory merge receipt.');
    const refs=await rowsFor(db,'movie_import_refs',[owner]);
    for(const member of op.members){
      const receipt=receipts.find(r=>r.source_movie_id===member.movie_id);
      if(receipt){const saved=JSON.parse(String(receipt.snapshot_json)) as Record<string,Row[]>;const original=saved.movie_import_refs.filter(r=>r.movie_id===member.movie_id);if(JSON.stringify(original.map(r=>r.source_ref).sort())!==JSON.stringify([...member.source_refs].sort())||original.some(r=>!refs.some(f=>f.import_source===r.import_source&&f.source_ref===r.source_ref)))throw Error('Merged provenance no longer matches receipt.');}
      else if(member.source_refs.some(ref=>!refs.some(r=>r.source_ref===ref)))throw Error('Survivor source_refs missing.');
    }
    const snapshot=JSON.parse(String(receipts[0].snapshot_json)) as Record<string,Row[]>;
    for(const table of ['source_scores','seen_import_observations','session_movies','builder_movies']){
      const current=await rowsFor(db,table,[owner]);
      if(snapshot[table].some(row=>!current.some(now=>Object.keys(row).every(k=>now[k]===(k==='movie_id'?owner:row[k])))))throw Error('Completed merge has missing or changed durable observations/appearances.');
    }
    return {already:true as const,survivor:owner,operationHash,op,snapshot,removed:receipts.map(r=>String(r.source_movie_id))};
  }
  const ids=[...new Set([...op.members.map(m=>m.movie_id),...(owner?[owner]:[])])];
  const snapshot:Record<string,Row[]>={movies:state?state.movies.filter(r=>ids.includes(String(r.id))):await rowsFor(db,'movies',ids)};
  for(const table of relatedTables)snapshot[table]=state?state[table].filter(r=>ids.includes(String(r.movie_id))):await rowsFor(db,table,ids);
  for(const member of op.members){
    const movie=snapshot.movies.find(r=>r.id===member.movie_id)!;
    const refs=snapshot.movie_import_refs.filter(r=>r.movie_id===member.movie_id);
    if(!movie.import_source||movie.import_key!==member.movie_id||refs.some(r=>r.import_source!==movie.import_source)||JSON.stringify(refs.map(r=>r.source_ref).sort())!==JSON.stringify([...member.source_refs].sort()))throw Error('Stored import provenance/source_refs differs from manifest.');
  }
  const byProvider=new Map<string,string>();
  for(const e of snapshot.movie_external_ids){const known=byProvider.get(String(e.provider));if(known&&known!==e.external_id)throw Error('Members have contradictory external identities.');byProvider.set(String(e.provider),String(e.external_id));}
  if(byProvider.has('tmdb')&&byProvider.get('tmdb')!==op.tmdb_id)throw Error('Member has contradictory TMDB identity.');
  if(op.kind==='existing'&&!op.owner_confirmed){
    const target=snapshot.movies.find(r=>r.id===owner)!;
    for(const m of op.members){const source=snapshot.movies.find(r=>r.id===m.movie_id)!;
      const titles=[source.title,source.original_title].filter((t):t is string=>typeof t==='string');
      const targetTitles=[target.title,target.original_title].filter((t):t is string=>typeof t==='string');
      const aliases=(s:string)=>s.replace(/\bblvd\.?/gi,'Boulevard');
      if(!titles.some(a=>targetTitles.some(b=>near(aliases(a),aliases(b)))))throw Error('Stored titles indicate different films; identity review required.');
      if(source.year&&target.year&&Math.abs(Number(source.year)-Number(target.year))>1)throw Error('Stored years indicate different films.');
    }
  }
  for(const member of new Set(snapshot.seen_states.map(r=>r.member_id))){if(new Set(snapshot.seen_states.filter(r=>r.member_id===member).map(r=>r.seen)).size>1)throw Error('Conflicting effective Seen answers require owner reconciliation.');}
  // These observations have immutable unique keys; never overwrite or invent new keys.
  for(const [table,fields] of [['source_scores',['provider','metric','retrieved_via','fetched_at','source_ref']],['movie_assets',['provider','asset_type','reference']]] as const){const keys=new Set<string>();for(const row of snapshot[table]){const key=JSON.stringify(fields.map(f=>row[f]));if(keys.has(key))throw Error(`Overlapping ${table} observations cannot be merged losslessly.`);keys.add(key);}}
  const richness=(id:string)=>relatedTables.reduce((n,t)=>n+snapshot[t].filter(r=>r.movie_id===id).length,0)+Object.values(snapshot.movies.find(r=>r.id===id)!).filter(v=>v!==null).length;
  const survivor=owner??[...ids].sort((a,b)=>richness(b)-richness(a)||a.localeCompare(b))[0];
  const removed=ids.filter(id=>id!==survivor);
  if(!removed.length)throw Error('Merge requires a redundant canonical row.');
  const classics=snapshot.classics;
  if(new Set(classics.map(r=>r.source).filter(v=>v!==null)).size>1||new Set(classics.map(r=>r.legacy_reference).filter(v=>v!==null)).size>1)throw Error('Conflicting Classics source/reference values.');
  return {already:false as const,survivor,removed,ids,snapshot,operationHash,op};
}

export const removalTable='local_movie_removal_receipts';
export type Removal=Member&{appearance_count:number;classic:boolean;confirmation:'owner_confirmed';action:'remove_from_active_catalogue'};
export async function planRemoval(db:D1Database,op:Removal,state?:Record<string,Row[]>) {
  if(!['Small Axe: Lovers Rock','Small Axe: Mangrove','Time','Dekalog','The Untamed'].includes(op.title))throw Error('Removal is outside the authorised final-cleanup list.');
  await discoverRelationships(db);
  const operationHash=createHash('sha256').update(JSON.stringify(op)).digest('hex');
  const snapshot:Record<string,Row[]>={movies:state?state.movies.filter(r=>r.id===op.movie_id):await rowsFor(db,'movies',[op.movie_id])};
  if(!snapshot.movies.length){
    const exists=await db.prepare("SELECT name FROM sqlite_master WHERE name=?").bind(removalTable).first();
    const receipt=exists?await db.prepare(`SELECT operation_hash FROM ${removalTable} WHERE source_movie_id=?`).bind(op.movie_id).first<{operation_hash:string}>():null;
    if(receipt?.operation_hash===operationHash)return {already:true as const,op,operationHash,snapshot};
    throw Error('Missing removal movie has no matching receipt.');
  }
  for(const table of relatedTables)snapshot[table]=state?state[table].filter(r=>r.movie_id===op.movie_id):await rowsFor(db,table,[op.movie_id]);
  const movie=snapshot.movies[0],refs=snapshot.movie_import_refs;
  if(!movie.import_source||movie.import_key!==op.movie_id||refs.some(r=>r.import_source!==movie.import_source)||JSON.stringify(refs.map(r=>r.source_ref).sort())!==JSON.stringify([...op.source_refs].sort()))throw Error('Removal provenance/source_refs mismatch.');
  if(movie.title!==op.title||snapshot.session_movies.length!==op.appearance_count||Boolean(snapshot.classics.length)!==op.classic)throw Error('Removal title/appearance/membership state changed.');
  if(snapshot.builder_movies.length||snapshot.movie_external_ids.length)throw Error('Unexpected Builder/external identity prevents removal.');
  if(await receiptsExist(db)&&await db.prepare(`SELECT source_movie_id FROM ${receiptTable} WHERE survivor_movie_id=?`).bind(op.movie_id).first())throw Error('Removal would invalidate an earlier merge receipt.');
  return {already:false as const,op,operationHash,snapshot};
}
export async function applyRemoval(db:D1Database,plan:Awaited<ReturnType<typeof planRemoval>>) {
  if(plan.already)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${removalTable}(source_movie_id TEXT PRIMARY KEY,operation_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),removed_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')))` ).run();
  const id=plan.op.movie_id;
  const statements=[db.prepare(`INSERT INTO ${removalTable}(source_movie_id,operation_hash,snapshot_json) VALUES(?,?,?)`).bind(id,plan.operationHash,JSON.stringify(plan.snapshot))];
  for(const [table,rows] of Object.entries(plan.snapshot)){
    const key=table==='movies'?'id':'movie_id';
    statements.push(db.prepare(`UPDATE ${removalTable} SET snapshot_json=CASE WHEN (SELECT count(*) FROM ${quote(table)} WHERE ${key}=?)=? THEN snapshot_json ELSE NULL END WHERE source_movie_id=?`).bind(id,rows.length,id));
    for(const row of rows)statements.push(db.prepare(`UPDATE ${removalTable} SET snapshot_json=CASE WHEN EXISTS(SELECT 1 FROM ${quote(table)} WHERE ${Object.keys(row).map(c=>`${quote(c)} IS ?`).join(' AND ')}) THEN snapshot_json ELSE NULL END WHERE source_movie_id=?`).bind(...Object.values(row),id));
  }
  // Explicitly remove known dependents in FK order; immutable import fingerprints
  // and audit JSON stay unchanged and remain resolvable through the archived receipt.
  for(const table of ['seen_import_observations','session_movies','builder_movies','classics','classics_seed_allocations','source_scores','seen_states','movie_assets','movie_genres','movie_external_ids','movie_import_refs'])statements.push(db.prepare(`DELETE FROM ${table} WHERE movie_id=?`).bind(id));
  statements.push(db.prepare('DELETE FROM movies WHERE id=?').bind(id));
  await db.batch(statements);
}
export type MergePlan=Awaited<ReturnType<typeof planMerge>>;

export async function applyMerge(db:D1Database,plan:MergePlan,metadata?:ProviderMovie,captureScores=false) {
  if(plan.already)return;
  const {survivor,removed,ids,snapshot,operationHash,op}=plan;
  const repo=new Repository(db);
  if(metadata){
    if(!metadata.external_ids.some(e=>e.provider==='tmdb'&&e.external_id===op.tmdb_id)||!metadata.title)throw Error('Returned TMDB film identity differs.');
    for(const external of metadata.external_ids){const owner=await repo.findExternal(external.provider,external.external_id);if(owner&&!ids.includes(owner))throw Error('Returned external identity belongs to another film.');const existing=snapshot.movie_external_ids.find(e=>e.provider===external.provider);if(existing&&existing.external_id!==external.external_id)throw Error('Returned external identity contradicts stored identity.');}
  }
  const statements:D1PreparedStatement[]=[];
  // Guard every movie and FK row read during preflight, inside the same transaction.
  statements.push(db.prepare(`INSERT INTO ${receiptTable}(source_movie_id,survivor_movie_id,tmdb_id,operation_hash,snapshot_json) VALUES(?,?,?,?,?)`).bind(removed[0],survivor,op.tmdb_id,operationHash,JSON.stringify(snapshot)));
  const guard=(predicate:string,values:Value[])=>statements.push(db.prepare(`UPDATE ${receiptTable} SET snapshot_json=CASE WHEN ${predicate} THEN snapshot_json ELSE NULL END WHERE source_movie_id=?`).bind(...values,removed[0]));
  for(const [table,rows] of Object.entries(snapshot)){
    const key=table==='movies'?'id':'movie_id',where=`${quote(key)} IN (${ids.map(()=>'?').join(',')})`;
    guard(`(SELECT count(*) FROM ${quote(table)} WHERE ${where})=?`,[...ids,rows.length]);
    for(const row of rows)guard(`EXISTS(SELECT 1 FROM ${quote(table)} WHERE ${Object.keys(row).map(c=>`${quote(c)} IS ?`).join(' AND ')})`,Object.values(row));
  }
  for(const id of removed.slice(1))statements.push(db.prepare(`INSERT INTO ${receiptTable}(source_movie_id,survivor_movie_id,tmdb_id,operation_hash,snapshot_json) VALUES(?,?,?,?,?)`).bind(id,survivor,op.tmdb_id,operationHash,JSON.stringify(snapshot)));
  const removedWhere=removed.map(()=>'?').join(',');
  const update=(table:string)=>statements.push(db.prepare(`UPDATE ${quote(table)} SET movie_id=? WHERE movie_id IN (${removedWhere})`).bind(survivor,...removed));
  for(const table of ['session_movies','builder_movies','movie_import_refs','source_scores','seen_import_observations'])update(table);
  // Latest conclusive dimension wins; equal timestamps prefer available, then survivor.
  const checks=[...snapshot.movie_score_checks].sort((a,b)=>String(b.checked_at).localeCompare(String(a.checked_at))||Number(b.available)-Number(a.available)||Number(b.movie_id===survivor)-Number(a.movie_id===survivor));
  const checkKeys=new Set<Value>();
  for(const check of checks){if(checkKeys.has(check.score_key))continue;checkKeys.add(check.score_key);statements.push(db.prepare(`INSERT INTO movie_score_checks(movie_id,score_key,available,checked_at) VALUES(?,?,?,?) ON CONFLICT(movie_id,score_key) DO UPDATE SET available=excluded.available,checked_at=excluded.checked_at`).bind(survivor,check.score_key,check.available,check.checked_at));}
  // Keep asset observations; exactly one deterministic preferred reference per type.
  statements.push(db.prepare(`UPDATE movie_assets SET preferred=0 WHERE movie_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids));update('movie_assets');
  for(const type of ['poster','backdrop']){const asset=snapshot.movie_assets.filter(r=>r.asset_type===type).sort((a,b)=>Number(b.movie_id===survivor)-Number(a.movie_id===survivor)||Number(b.preferred)-Number(a.preferred)||String(b.fetched_at).localeCompare(String(a.fetched_at))||String(a.id).localeCompare(String(b.id)))[0];if(asset)statements.push(db.prepare('UPDATE movie_assets SET preferred=1 WHERE id=?').bind(asset.id));}
  for(const genre of new Set(snapshot.movie_genres.map(r=>r.genre)))statements.push(db.prepare('INSERT OR IGNORE INTO movie_genres VALUES(?,?)').bind(survivor,genre));
  for(const state of snapshot.seen_states.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))))statements.push(db.prepare('INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen,updated_at) VALUES(?,?,?,?)').bind(survivor,state.member_id,state.seen,state.updated_at));
  for(const state of snapshot.seen_states.filter(r=>r.movie_id===survivor)){const latest=snapshot.seen_states.filter(r=>r.member_id===state.member_id).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0];statements.push(db.prepare('UPDATE seen_states SET updated_at=? WHERE movie_id=? AND member_id=?').bind(latest.updated_at,survivor,state.member_id));}
  // Preserve each original membership/seed in the receipt; effective identity uses minimum seed.
  const allocations=snapshot.classics_seed_allocations;
  if(allocations.length){
    const seed=Math.min(...allocations.map(r=>Number(r.rank_seed)));
    statements.push(db.prepare(`DELETE FROM classics WHERE movie_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids),db.prepare(`DELETE FROM classics_seed_allocations WHERE movie_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids),db.prepare('INSERT INTO classics_seed_allocations VALUES(?,?)').bind(survivor,seed));
    if(snapshot.classics.length){const c=[...snapshot.classics].sort((a,b)=>String(a.added_at).localeCompare(String(b.added_at)))[0];statements.push(db.prepare('INSERT INTO classics(movie_id,added_at,source,legacy_reference,rank_seed) VALUES(?,?,?,?,?)').bind(survivor,c.added_at,snapshot.classics.find(r=>r.source!==null)?.source??null,snapshot.classics.find(r=>r.legacy_reference!==null)?.legacy_reference??null,seed));}
  }
  const scalarFields=['original_title','year','release_date','runtime','overview','tmdb_metadata_checked_at','tmdb_artwork_checked_at'];
  for(const field of scalarFields){const target=snapshot.movies.find(r=>r.id===survivor)!;if(target[field]===null){const source=snapshot.movies.filter(r=>r[field]!==null).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];if(source)statements.push(db.prepare(`UPDATE movies SET ${quote(field)}=? WHERE id=?`).bind(source[field],survivor));}}
  // Repoint unique external aliases before deletion; conflicts abort the transaction.
  for(const external of snapshot.movie_external_ids.filter(r=>r.movie_id!==survivor))statements.push(db.prepare('UPDATE movie_external_ids SET movie_id=? WHERE movie_id=? AND provider=?').bind(survivor,external.movie_id,external.provider));
  if(!snapshot.movie_external_ids.some(r=>r.provider==='tmdb'))statements.push(db.prepare("INSERT INTO movie_external_ids VALUES(?,'tmdb',?)").bind(survivor,op.tmdb_id));
  if(metadata)statements.push(...repo.metadataStatements(survivor,metadata,captureScores));
  // Old immutable audit/fingerprint IDs remain resolvable through these durable receipts.
  statements.push(db.prepare(`UPDATE ${receiptTable} SET survivor_movie_id=? WHERE survivor_movie_id IN (${removedWhere})`).bind(survivor,...removed));
  for(const table of ['movie_genres','seen_states'])statements.push(db.prepare(`DELETE FROM ${table} WHERE movie_id IN (${removedWhere})`).bind(...removed));
  for(const id of removed)statements.push(db.prepare('DELETE FROM movies WHERE id=?').bind(id));
  await db.batch(statements);
}

export function mergeSummary(plan:MergePlan) {
  return {source_movie_ids:plan.removed,manifest_member_movie_ids:plan.op.members.map(m=>m.movie_id),survivor_movie_id:plan.survivor,tmdb_id:plan.op.tmdb_id,preserved_appearance_count:plan.snapshot.session_movies.length,preserved_classics:plan.snapshot.classics,preserved_rank_seeds:plan.snapshot.classics_seed_allocations,preserved_score_observation_count:plan.snapshot.source_scores.length,preserved_seen_observation_count:plan.snapshot.seen_import_observations.length,preserved_seen_states:plan.snapshot.seen_states,preserved_source_refs:plan.snapshot.movie_import_refs,result:plan.already?'already_applied; matching receipt and surviving provenance verified':'merged transactionally; original scalar/membership states retained in durable receipt'};
}
