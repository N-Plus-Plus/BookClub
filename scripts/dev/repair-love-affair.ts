import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { relatedTables } from './tmdb-merge';

export const sourceId = 'import-130514848afaf5474adb56a3';
export const operation = 'love-affair-identity-repair-v1';
const q = (v: unknown): string => v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
const ident = (v: string) => `"${v.replaceAll('"','""')}"`;
const digest = (v: string) => createHash('sha256').update(v).digest('hex');

/** Exact owner-authorised mismatch only. Output is private, atomic, guarded and repeat-safe. */
export function loveAffairRepairSql(db: DatabaseSync): {sql: string | null; survivor: string; mode: 'in-place' | 'merge'} {
  const rows = (t: string,w: string) => db.prepare(`SELECT * FROM ${ident(t)} WHERE ${w}`).all();
  const fail = (): never => { throw Error('Love Affair repair preflight conflict; inspect private evidence.'); };
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>String(r.name));
  const owners = rows('movie_external_ids',"(provider='tmdb' AND external_id='43739') OR (provider='imdb' AND external_id='tt0031593')");
  const ownerIds = [...new Set(owners.map(r=>String(r.movie_id)))];
  if (ownerIds.length > 1) fail();
  const survivor = ownerIds[0] ?? sourceId, mode = survivor === sourceId ? 'in-place' : 'merge';
  const original = rows('movies',`id=${q(sourceId)}`);
  const receipt = tables.includes('movie_identity_merge_receipts') ? rows('movie_identity_merge_receipts',`source_movie_id=${q(sourceId)}`)[0] : undefined;
  const target = rows('movies',`id=${q(survivor)}`)[0];
  const verifyTarget = () => {
    if (!target || target.title !== 'Love Affair' || target.year !== 1939 || target.director !== 'Leo McCarey') fail();
    const ids=rows('movie_external_ids',`movie_id=${q(survivor)}`);
    if (!ids.some(r=>r.provider==='tmdb' && r.external_id==='43739') || !ids.some(r=>r.provider==='imdb' && r.external_id==='tt0031593')) fail();
  };
  if (receipt) {
    verifyTarget();
    if (receipt.survivor_movie_id!==survivor || receipt.operation_hash!==operation || receipt.tmdb_id!=='43739' || (mode==='merge' && original.length) || rows('movie_external_ids',"provider='tmdb' AND external_id='1037212'").length) fail();
    if (!tables.includes('movie_identity_operations') || !rows('movie_identity_operations',`operation_key=${q(operation)}`).length) fail();
    return {sql:null,survivor,mode};
  }
  if (original.length!==1 || original[0].title!=='Love Affair' || original[0].year!==1974 || original[0].import_source!=='legacy-spreadsheet' || original[0].import_key!==sourceId) fail();
  const sourceIds=rows('movie_external_ids',`movie_id=${q(sourceId)}`);
  if(sourceIds.length!==1 || sourceIds[0].provider!=='tmdb' || sourceIds[0].external_id!=='1037212') fail();
  if(mode==='merge') {
    if (!target || target.title!=='Love Affair' || target.year!==1939 || target.director!=='Leo McCarey') fail();
    const targetIds=rows('movie_external_ids',`movie_id=${q(survivor)}`);
    if(targetIds.some(r=>(r.provider==='tmdb' && r.external_id!=='43739') || (r.provider==='imdb' && r.external_id!=='tt0031593'))) fail();
  }
  const ids=[...new Set([sourceId,survivor])], scope=`movie_id IN (${ids.map(q).join(',')})`;
  const snapshot: Record<string, unknown> = {};
  const guards: string[]=[];
  const capture=(table:string,where:string) => {
    const captured=rows(table,where); snapshot[table]=captured;
    guards.push(`SELECT CASE WHEN (SELECT count(*) FROM ${ident(table)} WHERE ${where})<>${captured.length} THEN RAISE(ABORT,'Love Affair repair raced') END;`);
    for(const row of captured) guards.push(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ${ident(table)} WHERE ${Object.entries(row).map(([k,v])=>`${ident(k)} IS ${q(v)}`).join(' AND ')}) THEN RAISE(ABORT,'Love Affair repair raced') END;`);
    return captured;
  };
  capture('movies',`id IN (${ids.map(q).join(',')})`);
  for(const t of tables) {
    for(const fk of db.prepare(`PRAGMA foreign_key_list(${ident(t)})`).all().filter(f=>f.table==='movies')) {
      if(!relatedTables.includes(t as typeof relatedTables[number]) && t!=='movie_identity_merge_receipts') fail();
      if(t==='movie_identity_merge_receipts' && rows(t,`${ident(String(fk.from))}=${q(sourceId)}`).length) fail();
    }
    if(relatedTables.includes(t as typeof relatedTables[number])) capture(t,scope);
  }
  capture('members','active=1');
  capture('sessions',`id IN (SELECT session_id FROM session_movies WHERE ${scope})`);
  capture('movie_external_ids',`${scope} OR (provider='tmdb' AND external_id IN ('43739','1037212')) OR (provider='imdb' AND external_id='tt0031593')`);
  if(tables.includes('movie_identity_merge_receipts')) capture('movie_identity_merge_receipts',`source_movie_id IN (${ids.map(q).join(',')}) OR survivor_movie_id IN (${ids.map(q).join(',')})`);
  if(tables.includes('movie_identity_operations') && rows('movie_identity_operations',`operation_key=${q(operation)}`).length) fail();
  const sourceScores=rows('source_scores',`movie_id=${q(sourceId)}`);
  const retained=sourceScores.filter(r=>r.retrieved_via==='legacy-spreadsheet' && r.import_source==='legacy-spreadsheet');
  if(mode==='merge') {
    const targetScores=rows('source_scores',`movie_id=${q(survivor)}`);
    if(retained.some(r=>targetScores.some(t=>['provider','metric','retrieved_via','fetched_at','source_ref'].every(k=>t[k]===r[k])))) fail();
    const sourceSeen=rows('seen_states',`movie_id=${q(sourceId)}`), targetSeen=rows('seen_states',`movie_id=${q(survivor)}`);
    if(sourceSeen.some(r=>targetSeen.some(t=>t.member_id===r.member_id && t.seen!==r.seen))) fail();
    const memberships=rows('classics',scope);
    for(const field of ['source','legacy_reference']) if(new Set(memberships.map(r=>r[field]).filter(v=>v!==null)).size>1) fail();
  }
  const changes:string[]=[];
  // Archive all prior provider material; retain only original spreadsheet score observations.
  changes.push(`DELETE FROM source_scores WHERE movie_id=${q(sourceId)} AND id NOT IN (${retained.map(r=>q(r.id)).join(',') || 'NULL'});`);
  // NOT IN (NULL) would retain everything when there are no legacy observations.
  if(!retained.length) changes[0]=`DELETE FROM source_scores WHERE movie_id=${q(sourceId)};`;
  for(const table of ['movie_assets','movie_genres','movie_score_checks',...relatedTables.filter(t=>t.startsWith('movie_provider_') || t.startsWith('movie_maintenance_'))]) if(tables.includes(table)) changes.push(`DELETE FROM ${ident(table)} WHERE movie_id=${q(sourceId)};`);
  changes.push(`DELETE FROM movie_external_ids WHERE movie_id=${q(sourceId)};`);
  if(mode==='merge') {
    for(const t of ['session_movies','builder_movies','movie_import_refs','seen_import_observations','source_scores']) changes.push(`UPDATE ${t} SET movie_id=${q(survivor)} WHERE movie_id=${q(sourceId)};`);
    changes.push(`INSERT INTO seen_states(movie_id,member_id,seen,updated_at) SELECT ${q(survivor)},member_id,seen,updated_at FROM seen_states WHERE movie_id=${q(sourceId)} ON CONFLICT(movie_id,member_id) DO UPDATE SET updated_at=max(seen_states.updated_at,excluded.updated_at);`);
    const allocations=rows('classics_seed_allocations',scope);
    if(allocations.length) {
      const seed=Math.min(...allocations.map(r=>Number(r.rank_seed))), memberships=rows('classics',scope).sort((a,b)=>String(a.added_at).localeCompare(String(b.added_at)));
      changes.push(`DELETE FROM classics WHERE ${scope};`,`DELETE FROM classics_seed_allocations WHERE ${scope};`,`INSERT INTO classics_seed_allocations VALUES(${q(survivor)},${seed});`);
      if(memberships.length) {const c=memberships[0];changes.push(`INSERT INTO classics(movie_id,added_at,source,legacy_reference,rank_seed) VALUES(${q(survivor)},${q(c.added_at)},${q(memberships.find(r=>r.source!==null)?.source??null)},${q(memberships.find(r=>r.legacy_reference!==null)?.legacy_reference??null)},${seed});`);}
    }
    changes.push(`DELETE FROM movies WHERE id=${q(sourceId)};`);
  } else changes.push(`UPDATE movies SET ${Object.hasOwn(target!,'title_source') ? "title_source=CASE WHEN import_source='legacy-spreadsheet' THEN 'legacy-spreadsheet' ELSE 'manual' END," : ''}title='Love Affair',original_title='Love Affair',year=1939,director='Leo McCarey',runtime=88,release_date=NULL,overview=NULL,tmdb_metadata_checked_at=NULL,tmdb_artwork_checked_at=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=${q(survivor)};`);
  changes.push(`INSERT OR IGNORE INTO movie_external_ids VALUES(${q(survivor)},'tmdb','43739'),(${q(survivor)},'imdb','tt0031593');`);
  changes.push(`INSERT INTO seen_states(movie_id,member_id,seen) SELECT ${q(survivor)},id,1 FROM members WHERE active=1 AND EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=${q(survivor)} AND s.deleted_at IS NULL) ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=1,updated_at=CASE WHEN seen_states.seen=1 THEN seen_states.updated_at ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now') END;`);
  const sql=`CREATE TABLE IF NOT EXISTS movie_identity_merge_receipts(source_movie_id TEXT PRIMARY KEY,survivor_movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,tmdb_id TEXT NOT NULL,operation_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),merged_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS movie_identity_operations(operation_key TEXT PRIMARY KEY,manifest_hash TEXT NOT NULL,sql_hash TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
DROP TRIGGER IF EXISTS love_affair_repair;
CREATE TRIGGER love_affair_repair AFTER INSERT ON movie_identity_operations WHEN NEW.operation_key=${q(operation)} BEGIN
${guards.join('\n')}
INSERT INTO movie_identity_merge_receipts(source_movie_id,survivor_movie_id,tmdb_id,operation_hash,snapshot_json) VALUES(${q(sourceId)},${q(survivor)},'43739',${q(operation)},${q(JSON.stringify(snapshot))});
${changes.join('\n')}
END;
INSERT OR IGNORE INTO movie_identity_operations(operation_key,manifest_hash,sql_hash) VALUES(${q(operation)},${q(digest(JSON.stringify(snapshot)))},'__SQL_HASH__');
DROP TRIGGER love_affair_repair;`;
  return {sql:sql.replace('__SQL_HASH__',digest(sql)),survivor,mode};
}
