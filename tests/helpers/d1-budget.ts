/** Emulate invocation and bind limits that disposable SQLite does not enforce. */
export function d1Budget(source:D1Database,limit=40) {
  let count=0,max=0;
  const originals=new WeakMap<object,D1PreparedStatement>();
  const charge=(n=1)=>{count+=n;max=Math.max(max,count);if(count>limit)throw Error('D1 invocation query budget exceeded');};
  const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{
    const proxy=new Proxy(statement,{get(target,key){
      if(key==='bind')return (...args:unknown[])=>{if(args.length>100)throw Error('D1 maximum bound parameters exceeded');return wrap(target.bind(...args));};
      if(['first','all','run','raw'].includes(String(key)))return (...args:unknown[])=>{charge();return (Reflect.get(target,key) as (...args:unknown[])=>unknown).apply(target,args);};
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});originals.set(proxy,statement);return proxy;
  };
  const db=new Proxy(source,{get(target,key){
    if(key==='prepare')return (sql:string)=>{if((sql.match(/\bUNION\b/gi)??[]).length>4)throw Error('too many terms in compound SELECT: SQLITE_ERROR');return wrap(target.prepare(sql));};
    if(key==='batch')return (statements:D1PreparedStatement[])=>{charge(statements.length);return target.batch(statements.map(s=>originals.get(s)??s));};
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
  }});
  return {db,reset:()=>{count=0;},get count(){return count;},get max(){return max;}};
}
