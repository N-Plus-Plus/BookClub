import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function disposableD1(lastMigration?: string) {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync('worker/migrations').filter(n=>n.endsWith('.sql') && (!lastMigration || n<=lastMigration)).sort()) sqlite.exec(readFileSync(`worker/migrations/${name}`,'utf8'));
  function prepare(sql: string,values: SQLInputValue[] = []): unknown {
    return {bind: (...args: SQLInputValue[]) => prepare(sql,args),
      first: async () => sqlite.prepare(sql).get(...values) ?? null,
      all: async () => ({results: sqlite.prepare(sql).all(...values)}),
      run: async () => ({success: true,results: [],meta: sqlite.prepare(sql).run(...values)}),
      execute: () => { const statement=sqlite.prepare(sql); return {results: statement.columns().length ? statement.all(...values) : (statement.run(...values),[])}; },
    };
  }
  const db = {prepare,batch: async (statements: {execute: () => unknown}[]) => {
    sqlite.exec('BEGIN'); try {const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;} catch(e){sqlite.exec('ROLLBACK');throw e;}
  }} as unknown as D1Database;
  return {sqlite,db};
}
