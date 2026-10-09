/** All repository destination writes are fenced in the same atomic D1 batch. */
export function maintenanceJobDatabase(db:D1Database,jobId:string,token:string,execution:string):D1Database {
  const originals=new WeakMap<object,D1PreparedStatement>();
  const guard=()=>db.prepare('INSERT INTO maintenance_write_guard(slot,job_id,token,execution) VALUES(1,?,?,?) ON CONFLICT(slot) DO UPDATE SET job_id=excluded.job_id,token=excluded.token,execution=excluded.execution').bind(jobId,token,execution);
  const unwrap=(statement:D1PreparedStatement)=>originals.get(statement) ?? statement;
  const batch=async<T=unknown>(statements:D1PreparedStatement[])=> (await db.batch<T>([guard(),...statements.map(unwrap)])).slice(1);
  const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{
    const proxy=new Proxy(statement,{get(target,key){
      if(key==='bind')return (...args:unknown[])=>wrap(target.bind(...args));
      if(key==='run')return async()=> (await batch([target]))[0];
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});originals.set(proxy,statement);return proxy;
  };
  return new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>wrap(target.prepare(sql));if(key==='batch')return batch;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}
