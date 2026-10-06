import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { providerEnrichmentTables } from '../../shared/enrichment';

export const survivor = 'import-54c64501eb9c95218d8c8bbb';
export const duplicate = 'import-6667f6a95ca5c9ae57a0bc6f';
const operation = 'singin-in-the-rain-identity-repair-v1';
const quote = (value: unknown): string => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const owned: readonly string[] = ['movie_external_ids','movie_genres','movie_assets','session_movies','classics','seen_states','classics_seed_allocations','source_scores','movie_import_refs','seen_import_observations','builder_movies','movie_score_checks',...providerEnrichmentTables];

/** Generate private, snapshot-guarded D1 SQL from a local/offline database. No provider calls. */
export function repairSql(db: DatabaseSync): string | null {
  const rows = (table: string, scope: string) => db.prepare(`SELECT * FROM ${identifier(table)} WHERE ${scope}`).all();
  const source = rows('movies', `id=${quote(duplicate)}`);
  const target = rows('movies', `id=${quote(survivor)}`);
  const fail = () => { throw new Error('Singin repair preflight conflict; inspect private local evidence.'); };
  if (target.length !== 1 || target[0].year !== 1952 || target[0].title !== "Singin' in the Rain") fail();
  const ids = rows('movie_external_ids', `movie_id=${quote(survivor)}`);
  if (!ids.some(r=>r.provider==='imdb' && r.external_id==='tt0045152') || !ids.some(r=>r.provider==='tmdb' && r.external_id==='872')) fail();
  const history = db.prepare(`SELECT s.id,s.cycle_id FROM sessions s JOIN session_movies sm ON sm.session_id=s.id JOIN cycles c ON c.id=s.cycle_id WHERE sm.movie_id=? AND c.ordinal=34`).all(survivor);
  if (history.length!==1) fail();
  const tables = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table'").all();
  if (!source.length) {
    const receipt = tables.some(t=>t.name==='movie_identity_merge_receipts') && db.prepare('SELECT * FROM movie_identity_merge_receipts WHERE source_movie_id=?').get(duplicate);
    if (!receipt || receipt.survivor_movie_id !== survivor || receipt.operation_hash !== operation || rows('movie_external_ids', "provider='tmdb' AND external_id='1438810'").length) fail();
    return null;
  }
  if (source[0].import_source !== 'legacy-spreadsheet' || source[0].import_key !== duplicate) fail();
  const sourceIds = rows('movie_external_ids', `movie_id=${quote(duplicate)}`);
  if (sourceIds.length !== 1 || sourceIds[0].provider !== 'tmdb' || sourceIds[0].external_id !== '1438810') fail();
  const scope = `movie_id IN (${quote(duplicate)},${quote(survivor)})`;
  const snapshots: Record<string, unknown> = {movies:source};
  const guards: string[] = [];
  const guard = (table: string, where: string) => {
    const captured = rows(table,where);
    guards.push(`SELECT CASE WHEN (SELECT count(*) FROM ${identifier(table)} WHERE ${where})<>${captured.length} THEN RAISE(ABORT,'Singin repair raced') END;`);
    for (const row of captured) guards.push(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ${identifier(table)} WHERE ${Object.entries(row).map(([k,v])=>`${identifier(k)} IS ${quote(v)}`).join(' AND ')}) THEN RAISE(ABORT,'Singin repair raced') END;`);
    return captured;
  };
  guard('movies', `id IN (${quote(duplicate)},${quote(survivor)})`);
  guard('sessions',`id=${quote(history[0].id)}`);
  guard('cycles',`id=${quote(history[0].cycle_id)}`);
  for (const table of tables) {
    const name = String(table.name);
    // Offline SQLite permits FK discovery; generated D1 SQL does not use this PRAGMA.
    const fks = db.prepare(`PRAGMA foreign_key_list(${identifier(name)})`).all();
    for (const fk of fks.filter(f=>f.table==='movies')) {
      if (!owned.includes(name) && name !== 'movie_identity_merge_receipts') fail();
      if (name==='movie_identity_merge_receipts') {
        if (rows(name,`${identifier(String(fk.from))}=${quote(duplicate)}`).length) fail();
        guard(name,`${identifier(String(fk.from))} IN (${quote(duplicate)},${quote(survivor)})`);
      }
    }
    if (!owned.includes(name)) continue;
    guard(name,scope);
    snapshots[name] = rows(name,`movie_id=${quote(duplicate)}`);
  }
  for (const name of ['classics','classics_seed_allocations','seen_states']) if (rows(name,`movie_id=${quote(survivor)}`).length) fail();
  if (rows('session_movies',`movie_id=${quote(duplicate)}`).length || rows('builder_movies',`movie_id=${quote(duplicate)}`).length) fail();
  const classics = rows('classics',`movie_id=${quote(duplicate)}`);
  if (classics.length!==1 || classics[0].rank_seed!==95 || classics[0].source!=='legacy-spreadsheet') fail();
  const scores = rows('source_scores',`movie_id=${quote(duplicate)}`);
  // Only original spreadsheet observations survive this wrong-provider identity.
  const retained = scores.filter(r=>r.retrieved_via==='legacy-spreadsheet' && r.import_source==='legacy-spreadsheet');
  const scoreIds = retained.map(r=>quote(r.id)).join(',') || 'NULL';
  const sql = `CREATE TABLE IF NOT EXISTS movie_identity_merge_receipts (
    source_movie_id TEXT PRIMARY KEY, survivor_movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL, operation_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    merged_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS movie_identity_operations (
    operation_key TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, sql_hash TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
DROP TRIGGER IF EXISTS singin_repair;
CREATE TRIGGER singin_repair AFTER INSERT ON movie_identity_operations WHEN NEW.operation_key=${quote(operation)} BEGIN
${guards.join('\n')}
INSERT INTO movie_identity_merge_receipts(source_movie_id,survivor_movie_id,tmdb_id,operation_hash,snapshot_json)
VALUES(${quote(duplicate)},${quote(survivor)},'872',${quote(operation)},${quote(JSON.stringify(snapshots))});
${['classics','classics_seed_allocations','seen_states','movie_import_refs','seen_import_observations'].map(t=>`UPDATE ${t} SET movie_id=${quote(survivor)} WHERE movie_id=${quote(duplicate)};`).join('\n')}
UPDATE source_scores SET movie_id=${quote(survivor)} WHERE movie_id=${quote(duplicate)} AND id IN (${scoreIds});
DELETE FROM movies WHERE id=${quote(duplicate)};
END;
INSERT OR IGNORE INTO movie_identity_operations(operation_key,manifest_hash,sql_hash) VALUES(${quote(operation)},${quote(createHash('sha256').update(JSON.stringify(snapshots)).digest('hex'))},'__SQL_HASH__');
DROP TRIGGER singin_repair;`;
  return sql.replace('__SQL_HASH__',createHash('sha256').update(sql).digest('hex'));
}
