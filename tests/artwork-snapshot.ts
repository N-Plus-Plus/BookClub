// Offline rendered-test fixture: read the existing local snapshot, mutate only memory.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { disposableD1 } from './d1';
import { copySnapshot } from '../scripts/dev/snapshot';
import { Repository } from '../worker/src/repository';
import { MovieService } from '../worker/src/services';
import { missingAnswers, sortClassics } from '../shared/ranking';
import { tmdbIdentity } from '../shared/metadata';

const source = new DatabaseSync('worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/a36f84ea60804f30bb0c7f7cad9f5336a6cca0165abdab8b9241d93dbf0b6006.sqlite',{readOnly:true});
const local = disposableD1();
copySnapshot(source,local.sqlite); source.close();
const repo = new Repository(local.db), before = await repo.catalog();
const desired = [missingAnswers(before.movies,before.members,before.members[0]?.id ?? '')[0]?.movie,...before.sessions[0].movies,
  ...sortClassics(before.movies.filter(m=>m.classic)).slice(0,5)].filter(m=>m && tmdbIdentity(m));
const sample = [...new Map(desired.map(m=>[m.id,m])).values()].slice(0,10);
// Limit eligibility in the disposable copy to the controlled sample only.
local.sqlite.prepare("UPDATE movies SET director='Fixture Director',tmdb_metadata_checked_at=?,tmdb_artwork_checked_at=?").run(new Date().toISOString(),new Date().toISOString());
for (const movie of sample) local.sqlite.prepare('UPDATE movies SET tmdb_metadata_checked_at=NULL,tmdb_artwork_checked_at=NULL WHERE id=?').run(movie.id);
globalThis.fetch = async (input) => {
  const id = new URL(String(input)).pathname.split('/').at(-1);
  const movie = sample.find(m=>tmdbIdentity(m)===id);
  if (!movie) throw Error('Only selected fixture identities may be requested.');
  return Response.json({id:Number(id),title:movie.title,original_title:movie.original_title,release_date:movie.release_date || `${movie.year || 2000}-01-01`,runtime:movie.runtime,
    overview:movie.overview,genres:movie.genres.map(name=>({name})),poster_path:'/fixture-poster.jpg',backdrop_path:'/fixture-backdrop.jpg',vote_average:0,vote_count:0,
    credits:{crew:[{job:'Director',name:'Fixture Director'}]},external_ids:{imdb_id:movie.external_ids.find(e=>e.provider==='imdb')?.external_id}});
};
const service = new MovieService(repo,{DB:local.db,APP_ENV:'local',LOCAL_WRITE_BYPASS:'true',ALLOWED_ORIGINS:'http://localhost:4173',TMDB_READ_TOKEN:'mock-only'});
const result = await service.enrichMetadata(10), after = await repo.catalog();
const resume = await service.enrichMetadata(10);
if (result.results.length !== sample.length || result.results.some(r=>r.status!=='success') || resume.results.length) throw Error('Controlled sample failed.');
writeFileSync('.verification/artwork-snapshot.json',JSON.stringify({before,after,result,sample:sample.map(m=>m.id)}));
local.sqlite.close();
console.log(`Offline sample: ${sample.length} films updated; resume made zero provider requests.`);
