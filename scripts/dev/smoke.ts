import assert from 'node:assert/strict';
import { calculateMetrics } from '../../shared/metrics.ts';
import { sortClassics } from '../../shared/ranking.ts';
import type { Catalog, MovieDetail, BuilderSet, Member } from '../../shared/types.ts';

const origin = 'http://localhost:4173', base = 'http://localhost:8787/api/v1';
async function call<T>(path:string,method='GET',body?:unknown,member?:string): Promise<T> {
  const response = await fetch(base+path,{method,headers:{Origin:origin,...(member ? {'X-BookClub-Dev-Member':member}:{}),...(body ? {'Content-Type':'application/json'}:{})},...(body ? {body:JSON.stringify(body)}:{})});
  assert.equal(response.ok,true,`Local API ${method} ${path}: ${response.status}`);
  return (await response.json() as {data:T}).data;
}
const health = await call<{environment:string;authenticationRequired:boolean}>('/health');
assert.equal(health.environment,'local'); assert.equal(health.authenticationRequired,false);
const catalog = await call<Catalog>('/catalog');
assert.equal(catalog.members.filter(m => m.active).length,4);
assert.ok(catalog.movies.length); assert.ok(catalog.sessions.length);
const metrics = calculateMetrics(catalog), order = sortClassics(catalog.movies.filter(m => m.classic));
assert.ok(metrics.appearances); assert.ok(order.length);
const roles = await Promise.all(catalog.members.map(m => call<{viewer:Member & {role:string}}>('/auth/me','GET',undefined,m.id)));
const admin = roles.find(r => r.viewer.role==='admin')!.viewer;
assert.ok(admin);
await call('/builders','GET',undefined,admin.id);
let builder = await call<BuilderSet>('/builders','POST',{title:'LOCAL isolation smoke',movie_ids:[catalog.movies[0].id]},admin.id);
try {
  builder = await call<BuilderSet>(`/builders/${builder.id}`,'PUT',{title:'LOCAL isolation smoke edited',movie_ids:[catalog.movies[0].id],revision:builder.revision},admin.id);
  assert.equal(builder.title,'LOCAL isolation smoke edited');
} finally {await call(`/builders/${builder.id}`,'DELETE',{revision:builder.revision},admin.id);}
const movie = catalog.movies[0], previous = movie.seen.find(s => s.member_id===admin.id);
try {
  const changed = await call<MovieDetail>(`/movies/${movie.id}/seen/${admin.id}`,'PUT',{seen:previous?.seen!==1},admin.id);
  assert.equal(changed.seen.find(s => s.member_id===admin.id)?.seen,previous?.seen===1 ? 0 : 1);
} finally {await call(`/movies/${movie.id}/seen/${admin.id}`,'PUT',{seen:previous ? Boolean(previous.seen) : null},admin.id);}
const adminCheck = await fetch(base+'/sessions/local-smoke-nonexistent/restore',{method:'POST',headers:{Origin:origin,'X-BookClub-Dev-Member':admin.id}});
assert.equal(adminCheck.status,404); // Passed the admin guard; no event was changed.
const denied = await fetch(origin+'/__dev/refresh',{method:'POST'});
assert.equal(denied.status,403);
assert.equal((await fetch(origin)).ok,true);
console.log(JSON.stringify({local:true,movies:catalog.movies.length,historyEvents:catalog.sessions.length,metricsAppearances:metrics.appearances,watchOrder:order.length,rotation:await call('/rotation'),builderCRUD:true,seenEditRestored:true,admin:true,refreshWithoutConfirmationRefused:true}));
