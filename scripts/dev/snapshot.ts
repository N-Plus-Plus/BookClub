import type { DatabaseSync } from 'node:sqlite';

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
export function verifyForeignKeys(db: DatabaseSync) {
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Snapshot foreign key verification failed.');
  if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Snapshot integrity verification failed.');
}
export function restoreExport(db: DatabaseSync, sql: string) {
  // D1 exports can restore a referencing table before its parent is created.
  // Enforce relationships after the complete offline restore, never mid-stream.
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec(sql);
  verifyForeignKeys(db);
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
  verifyForeignKeys(source);
  const names = tables(source), destination = tables(target);
  if (names.join() !== destination.join()) throw new Error('Source tables differ from current migrations; review schema compatibility.');
  const counts: Record<string, number> = {};
  const triggers = target.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
  target.exec('PRAGMA foreign_keys=OFF; BEGIN');
  try {
    for (const trigger of triggers) target.exec(`DROP TRIGGER ${quote(String(trigger.name))}`);
    for (const table of names) target.exec(`DELETE FROM ${quote(table)}`);
    for (const table of names) {
      const cols = columns(source,table), destCols = columns(target,table);
      if (cols.some(c => !destCols.includes(c))) throw new Error(`Source columns incompatible: ${table}.`);
      const rows = source.prepare(`SELECT * FROM ${quote(table)} ORDER BY rowid`).all();
      counts[table] = rows.length;
      const insert = target.prepare(`INSERT INTO ${quote(table)} (${cols.map(quote).join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      let expected = 0;
      for (const raw of rows) {
        const row = sanitise(table,raw);
        if (row) { insert.run(...cols.map(c => row[c])); expected++; }
      }
      if (Number(target.prepare(`SELECT count(*) n FROM ${quote(table)}`).get()?.n) !== expected) throw new Error(`Copy count mismatch: ${table}.`);
    }
    target.exec("INSERT OR IGNORE INTO seed_runs(name) VALUES('demo-v1')");
    for (const trigger of triggers) target.exec(String(trigger.sql));
    verifyForeignKeys(target);
    target.exec('COMMIT; PRAGMA foreign_keys=ON');
    const localCounts = Object.fromEntries(names.map(table => [table,Number(target.prepare(`SELECT count(*) n FROM ${quote(table)}`).get()?.n)]));
    return {sourceCounts:counts, localCounts, rotation: target.prepare('SELECT * FROM club_rotation').get() ?? null, authSessions: localCounts.auth_sessions};
  } catch (error) { target.exec('ROLLBACK; PRAGMA foreign_keys=ON'); throw error; }
}
