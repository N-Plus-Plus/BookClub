// Opt-in local API smoke check. Creates a labelled demo movie and event.
// Run against a disposable/seeded local database, then pnpm db:reset if desired.
import assert from 'node:assert/strict';
const base = 'http://localhost:8787/api/v1';
async function call(path,method = 'GET',body) {
  const response = await fetch(`${base}${path}`,{method,headers: {Origin: 'http://localhost:4173',...(body ? {'Content-Type': 'application/json'} : {})},...(body ? {body: JSON.stringify(body)} : {})});
  const result = await response.json();
  assert.equal(response.ok,true,JSON.stringify(result)); return result.data;
}
const health = await call('/health');
assert.equal(health.environment,'local'); assert.equal(health.authenticationRequired,false);
const catalog = await call('/catalog'); assert.equal(catalog.members.filter(m => m.active).length,4);
assert.ok(catalog.sessions.length >= 3);
const lookup = await call('/movies/search?q=Arrival'); assert.ok(lookup.local.some(m => m.id === 'arrival'));
const movie = await call('/movies','POST',{year: 2026,runtime: 90});
const ids = [movie.id,'moon','arrival','spirited'];
const event = await call('/sessions','POST',{event_date: '2026-10-04',movie_ids: ids,legacy_cycle_label: 'opaque smoke label'});
assert.deepEqual(event.movies.map(m => m.id),ids);
const reversed = await call(`/sessions/${event.id}`,'PUT',{event_date: '2026-10-04',movie_ids: [...ids].reverse(),legacy_cycle_label: 'opaque smoke label'});
assert.deepEqual(reversed.movies.map(m => m.id),[...ids].reverse());
assert.equal(reversed.legacy_cycle_label,'opaque smoke label');
const original = await call('/movies/bicycle');
const previous = original.seen.find(a => a.member_id === 'member-3');
try {
  const no = await call('/movies/bicycle/seen/member-3','PUT',{seen: false});
  assert.equal(no.ranking.unseenCount,original.ranking.unseenCount + (previous?.seen === 0 ? 0 : 1));
  const yes = await call('/movies/bicycle/seen/member-3','PUT',{seen: true});
  assert.equal(yes.ranking.seenCount,original.ranking.seenCount + (previous?.seen === 1 ? 0 : 1));
  assert.ok(no.ranking.finalScore > yes.ranking.finalScore);
} finally { await call('/movies/bicycle/seen/member-3','PUT',{seen: previous ? Boolean(previous.seen) : null}); }
assert.equal((await call('/movies/alien')).ranking.eligible,false);
assert.ok((await call(`/movies/${movie.id}`)).appearances.some(a => a.id === event.id));
const denied = await fetch(`${base}/health`,{headers: {Origin: 'https://untrusted.example'}}); assert.equal(denied.status,403);
console.log('Local API smoke passed: catalog, optional search, manual film, four-film event, update/order, live ranking, undo, detail, CORS.');
