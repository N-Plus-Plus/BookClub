import type { DatabaseSync } from 'node:sqlite';
import { providerEnrichmentTables } from '../../shared/enrichment';

export const sourceIdentity = {database_name: 'bookclub-prod', database_id: 'df848632-a192-4c64-9bfb-25c59d3aa631'};
export const localId = '00000000-0000-0000-0000-000000000001';
export function validateConfig(config: any) {
  const source = config.d1_databases;
  const local = config.env?.local;
  if (config.vars?.APP_ENV !== 'production' || config.vars?.LOCAL_WRITE_BYPASS !== 'false' || source?.length !== 1 || source[0].binding !== 'DB' || source[0].database_name !== sourceIdentity.database_name || source[0].database_id !== sourceIdentity.database_id || source[0].remote === true) throw new Error('Production source configuration mismatch.');
  if (local?.vars?.APP_ENV !== 'local' || local.vars.LOCAL_WRITE_BYPASS !== 'true' || local.d1_databases?.length !== 1 || local.d1_databases[0].binding !== 'DB' || local.d1_databases[0].database_name !== 'bookclub-local' || local.d1_databases[0].database_id !== localId || local.d1_databases[0].remote === true) throw new Error('Unsafe destination: exact local development binding required.');
}
export function validateIdentity(info: any) {
  if (info?.uuid !== sourceIdentity.database_id || info.name !== sourceIdentity.database_name) throw new Error('Remote production identity mismatch.');
}
const quote = (name: string) => '"' + name.replaceAll('"','""') + '"';
const tables = (db: DatabaseSync) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all().map(r => String(r.name)).sort();
const columns = (db: DatabaseSync, table: string) => db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(r => String(r.name));
// Explicit pre-0010 compatibility only; every other source-only column fails closed.
const retiredSessionColumns = ['title','notes','swap_note'];
// Additive 0016 caches may be absent from an older authorised source export.
const optionalEnrichmentTables: readonly string[]=providerEnrichmentTables;
// Production maintenance receipts are outside the application migration ledger.
// Create only these reviewed local schemas; never execute source CREATE SQL.
export const maintenanceSchemas: Record<string, string> = {
  movie_identity_operations: `CREATE TABLE movie_identity_operations (
    operation_key TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, sql_hash TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  movie_identity_merge_receipts: `CREATE TABLE movie_identity_merge_receipts (
    source_movie_id TEXT PRIMARY KEY, survivor_movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL, operation_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    merged_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  movie_identity_removal_receipts: `CREATE TABLE movie_identity_removal_receipts (
    source_movie_id TEXT PRIMARY KEY, operation_hash TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    removed_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
};
// Never forward raw SQLite messages: triggers/constraints can contain private text.
export function safeSnapshotError(error: unknown): string {
  if (error instanceof SnapshotOperationError) return error.message;
  const message = error instanceof Error ? error.message : '';
  for (const category of ['no such column: rowid','FOREIGN KEY constraint failed','UNIQUE constraint failed','NOT NULL constraint failed','CHECK constraint failed','malformed JSON','database is locked','database disk image is malformed']) {
    if (message.includes(category)) return category;
  }
  const code = (error as {code?: unknown} | null)?.code;
  return typeof code === 'string' && /^ERR_SQLITE_[A-Z_]+$/.test(code) ? code : 'details suppressed';
}
class SnapshotOperationError extends Error {}
function snapshotOperation<T>(context: string, action: () => T): T {
  try { return action(); }
  catch (error) { throw new SnapshotOperationError(`${context}: ${safeSnapshotError(error)}`); }
}
export function verifyForeignKeys(db: DatabaseSync) {
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new SnapshotOperationError('Snapshot foreign key verification failed.');
  if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new SnapshotOperationError('Snapshot integrity verification failed.');
}
export function restoreExport(db: DatabaseSync, sql: string) {
  // D1 exports can restore a referencing table before its parent is created.
  // Enforce relationships after the complete offline restore, never mid-stream.
  db.exec('PRAGMA foreign_keys=OFF');
  snapshotOperation('restoreExport / execute exported SQL', () => db.exec(sql));
  snapshotOperation('restoreExport / verify integrity and foreign keys', () => verifyForeignKeys(db));
}
export function sanitise(table: string, row: Record<string, any>): Record<string, any> | null {
  if (table === 'auth_sessions' || table === 'provider_cooldowns') return null;
  if (table === 'member_auth') return {...row, authorized_email: `${encodeURIComponent(row.member_id).toLowerCase()}@bookclub.invalid`, google_sub: null, bound_at: null, last_login_at: null};
  return row;
}
// Only offline, disposable SQLite files enter here. Current migration triggers are
// suspended while restoring historical rows, then restored in the same transaction.
// Replaying publication triggers would advance rotation and delete saved Builders.
export function copySnapshot(source: DatabaseSync, target: DatabaseSync) {
  snapshotOperation('copySnapshot / source integrity and foreign keys', () => verifyForeignKeys(source));
  const names = tables(source), destination = tables(target);
  const extra = names.filter(name => !destination.includes(name));
  const unknown = extra.filter(name => !Object.hasOwn(maintenanceSchemas,name));
  const missing = destination.filter(name => !names.includes(name) && !optionalEnrichmentTables.includes(name));
  if (unknown.length || missing.length) throw new SnapshotOperationError(`copySnapshot / schema comparison: Source tables differ from current migrations; unreviewed source tables: ${unknown.length}; missing destination tables: ${missing.join(', ') || 'none'}.`);
  const counts: Record<string, number> = {};
  const triggers = target.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
  let operation = 'destination / begin transaction';
  target.exec('PRAGMA foreign_keys=OFF; BEGIN');
  try {
    for (const table of extra) {
      operation = `destination schema / create reviewed maintenance table ${table}`;
      target.exec(maintenanceSchemas[table]);
      const shape = (db: DatabaseSync) => db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(c => [c.name,c.type,c.notnull,c.pk]);
      if (JSON.stringify(shape(source)) !== JSON.stringify(shape(target))) throw new SnapshotOperationError(`Source columns incompatible: ${table}.`);
    }
    operation = 'destination schema / suspend triggers';
    for (const trigger of triggers) target.exec(`DROP TRIGGER ${quote(String(trigger.name))}`);
    for (const table of names) { operation = `destination table ${table} / delete`; target.exec(`DELETE FROM ${quote(table)}`); }
    for (const table of names) {
      operation = `table ${table} / compare columns`;
      const sourceCols = columns(source,table), destCols = columns(target,table);
      if (sourceCols.some(c => !destCols.includes(c) && !(table === 'sessions' && retiredSessionColumns.includes(c)))) throw new SnapshotOperationError(`Source columns incompatible: ${table}.`);
      const cols = sourceCols.filter(c => destCols.includes(c));
      operation = `source table ${table} / select rows`;
      const rows = source.prepare(`SELECT * FROM ${quote(table)} ORDER BY rowid`).all();
      counts[table] = rows.length;
      operation = `destination table ${table} / prepare insert`;
      const insert = target.prepare(`INSERT INTO ${quote(table)} (${cols.map(quote).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      operation = `destination table ${table} / insert sanitised rows`;
      let expected = 0;
      for (const raw of rows) {
        const row = sanitise(table,raw);
        if (row) { insert.run(...cols.map(c => row[c])); expected++; }
      }
      operation = `destination table ${table} / verify count`;
      if (Number(target.prepare(`SELECT count(*) n FROM ${quote(table)}`).get()?.n) !== expected) throw new SnapshotOperationError(`Copy count mismatch: ${table}.`);
    }
    // Mirror migration 0010 for audit rows copied after the destination was migrated.
    operation = 'destination table history_audit / remove retired audit fields';
    target.exec(`UPDATE history_audit SET changes_json=json_remove(changes_json,
      '$.before.title','$.before.notes','$.before.swap_note',
      '$.after.title','$.after.notes','$.after.swap_note')
      WHERE json_type(changes_json,'$.before.title') IS NOT NULL
         OR json_type(changes_json,'$.before.notes') IS NOT NULL
         OR json_type(changes_json,'$.before.swap_note') IS NOT NULL
         OR json_type(changes_json,'$.after.title') IS NOT NULL
         OR json_type(changes_json,'$.after.notes') IS NOT NULL
         OR json_type(changes_json,'$.after.swap_note') IS NOT NULL`);
    operation = 'destination table seed_runs / seed marker';
    target.exec("INSERT OR IGNORE INTO seed_runs(name) VALUES('demo-v1')");
    operation = 'destination schema / restore triggers';
    for (const trigger of triggers) target.exec(String(trigger.sql));
    operation = 'destination / verify integrity and foreign keys';
    verifyForeignKeys(target);
    operation = 'destination / commit';
    target.exec('COMMIT; PRAGMA foreign_keys=ON');
    const localCounts = Object.fromEntries(names.map(table => [table,Number(target.prepare(`SELECT count(*) n FROM ${quote(table)}`).get()?.n)]));
    return {sourceCounts:counts, localCounts, rotation: target.prepare('SELECT * FROM club_rotation').get() ?? null, authSessions: localCounts.auth_sessions};
  } catch (error) { target.exec('ROLLBACK; PRAGMA foreign_keys=ON'); throw new SnapshotOperationError(`copySnapshot / ${operation}: ${safeSnapshotError(error)}`); }
}
