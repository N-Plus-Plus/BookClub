import { z } from 'zod';
import { Repository } from '../../worker/src/repository.ts';
import { MovieService } from '../../worker/src/services.ts';
import { TmdbProvider } from '../../worker/src/providers/tmdb.ts';
import { ProviderError } from '../../worker/src/providers/http.ts';
import { ApiError } from '../../worker/src/http.ts';
import type { Env } from '../../worker/src/http.ts';
import type { ProviderMovie } from '../../worker/src/providers/types.ts';

const pairingSchema = z.object({movie_id:z.string().min(1),title:z.string().min(1),source_refs:z.array(z.string().regex(/^(Tracker|Should Watch):/)).min(1),tmdb_id:z.string().regex(/^[1-9]\d{0,9}$/),matched_title:z.string().min(1),matched_year:z.number().int().min(1800).max(2200),confidence:z.literal('high')});
export function parseManifest(input: unknown) {
  const manifest = z.object({version:z.literal(1),matched_count:z.number().int(),pairings:z.array(pairingSchema)}).parse(input);
  if (manifest.matched_count !== manifest.pairings.length) throw new Error('Manifest count mismatch.');
  for (const field of ['movie_id','tmdb_id'] as const) if(new Set(manifest.pairings.map(p=>p[field])).size!==manifest.pairings.length) throw new Error('Duplicate manifest identity.');
  for (const p of manifest.pairings) if(new Set(p.source_refs).size!==p.source_refs.length) throw new Error('Duplicate manifest source ref.');
  return manifest;
}
export type Pairing = z.infer<typeof pairingSchema>;
const normalized = (title:string) => title.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'').replace(/^the/,'');
export function near(a:string,b:string) {
  // A displayed subtitle does not change the identity of an otherwise exact title.
  const mainA=a.split(/[:–—]/,1)[0],mainB=b.split(/[:–—]/,1)[0];
  if ((mainA!==a || mainB!==b) && normalized(mainA).length>=8 && normalized(mainA)===normalized(mainB))return true;
  a=normalized(a); b=normalized(b);
  if(a===b)return true;
  if(Math.min(a.length,b.length)<8)return false;
  let previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=next;}
  return previous[b.length]<=Math.max(2,Math.floor(Math.max(a.length,b.length)*0.12));
}
export function compatibility(p:Pairing,m:ProviderMovie):string|null {
  if(!m.external_ids.some(e=>e.provider==='tmdb'&&e.external_id===p.tmdb_id))return 'TMDB returned a different ID.';
  if(!m.title || !Number.isInteger(m.year))return 'Returned title/year unavailable; manual review required.';
  if(Math.abs(m.year!-p.matched_year)>1)return `Returned year ${m.year} contradicts matched year ${p.matched_year}.`;
  if(![m.title,m.original_title].some(t=>t&&[p.matched_title,p.title].some(s=>near(t,s))))return `Returned title ${m.title} is not compatible; alias/manual review required.`;
  return null;
}
export async function preflight(db:D1Database,p:Pairing) {
  const movie=await db.prepare('SELECT import_source,import_key FROM movies WHERE id=?').bind(p.movie_id).first<{import_source:string;import_key:string}>();
  if(!movie)return {reason:'movie_id does not exist.'};
  const refs=(await db.prepare('SELECT import_source,source_ref FROM movie_import_refs WHERE movie_id=? ORDER BY source_ref').bind(p.movie_id).all<{import_source:string;source_ref:string}>()).results;
  if(!movie.import_source || movie.import_key!==p.movie_id || refs.some(r=>r.import_source!==movie.import_source) || JSON.stringify(refs.map(r=>r.source_ref).sort())!==JSON.stringify([...p.source_refs].sort()))return {reason:'Stored import provenance/source_refs differs from manifest.'};
  const ids=(await db.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=?').bind(p.movie_id).all<{provider:string;external_id:string}>()).results;
  const tmdb=ids.find(e=>e.provider==='tmdb');
  if(tmdb&&tmdb.external_id!==p.tmdb_id)return {reason:'Movie already has a different TMDB identity.'};
  const owner=await new Repository(db).findExternal('tmdb',p.tmdb_id);
  if(owner&&owner!==p.movie_id)return {reason:'Proposed TMDB ID belongs to another canonical movie.'};
  if(tmdb){const checked=await db.prepare('SELECT tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies WHERE id=?').bind(p.movie_id).first<{tmdb_metadata_checked_at:string|null;tmdb_artwork_checked_at:string|null}>();return checked?.tmdb_metadata_checked_at&&checked.tmdb_artwork_checked_at?{already:true}:{reason:'TMDB attached without completed metadata/artwork; manual review required.'};}
  if(ids.some(e=>e.provider!=='tmdb'))return {reason:'Existing non-TMDB identity requires manual reconciliation.'};
  return {attachment:{import_source:movie.import_source,source_refs:p.source_refs}};
}
export async function runPairings(db:D1Database,manifest:ReturnType<typeof parseManifest>,options:{apply:boolean;token?:string;save:(report:unknown)=>Promise<void>;progress?:(done:number)=>void;integrity?:()=>Promise<Record<string,unknown>[]>}) {
  const repo=new Repository(db),before=await repo.catalog();
  const original=before.movies.flatMap(m=>m.external_ids.filter(e=>e.provider==='tmdb').map(e=>({movie_id:m.id,external_id:e.external_id})));
  const unidentified=before.movies.length-original.length;
  const report={mode:options.apply?'apply':'preflight',proposed:manifest.pairings.length,accepted:[] as object[],already_applied:[] as object[],rejected:[] as object[],conflicts:[] as object[],provider_failures:[] as object[],eligible:0,provider_calls:0,remaining_without_tmdb:unidentified,baseline_identified:original.length,baseline_without_tmdb:unidentified,verification:{} as Record<string,unknown>};
  const eligible:Pairing[]=[];
  const entry=(p:Pairing,reason?:string)=>({movie_id:p.movie_id,title:p.title,tmdb_id:p.tmdb_id,...(reason?{reason}:{})});
  for(const p of manifest.pairings){const check=await preflight(db,p);if(check.reason)report.conflicts.push(entry(p,check.reason));else if(check.already)report.already_applied.push(entry(p));else eligible.push(p);}
  report.eligible=eligible.length;await options.save(report);
  if(options.apply){
    if(!options.token)throw new Error('Local TMDB provider token is not configured.');
    const provider=new TmdbProvider(options.token);
    for(const p of eligible){
      const check=await preflight(db,p);
      if(check.reason){report.conflicts.push(entry(p,check.reason));continue;}
      if(check.already){report.already_applied.push(entry(p));continue;}
      try {
        const wait=await repo.providerCooldown('tmdb');
        if(wait!==null)throw new ProviderError('TMDB','rate_limited','TMDB cooldown active.',wait);
        report.provider_calls++;
        const snapshot=await provider.details(p.tmdb_id),reason=compatibility(p,snapshot);
        if(reason)report.rejected.push(entry(p,reason));
        else {await repo.enrichMetadata(p.movie_id,p.tmdb_id,snapshot,check.attachment);report.accepted.push({...entry(p),returned_title:snapshot.title,year:snapshot.year,metadata_checked_at:snapshot.fetched_at,assets:snapshot.assets.map(a=>a.asset_type)});report.remaining_without_tmdb--;}
      }catch(error){
        if(error instanceof ApiError&&error.status===409)report.conflicts.push(entry(p,error.message));
        else {report.provider_failures.push(entry(p,error instanceof ProviderError?error.message:'Provider response or local write failed; retry safely.'));if(error instanceof ProviderError&&error.kind==='rate_limited')await repo.setProviderCooldown('tmdb',error.retryAfter??60);}
        await options.save(report);
        if(!(error instanceof ApiError&&error.status===409) && !(error instanceof ProviderError&&error.kind==='not_found'))break;
      }
      await options.save(report);options.progress?.(report.accepted.length+report.rejected.length+report.conflicts.length);
      await new Promise(done=>setTimeout(done,100));
    }
  }
  const after=await repo.catalog();
  report.remaining_without_tmdb=after.movies.filter(m=>!m.external_ids.some(e=>e.provider==='tmdb')).length;
  const integrity=options.integrity?await options.integrity():(await db.prepare('PRAGMA integrity_check').all()).results;
  const fks=(await db.prepare('PRAGMA foreign_key_check').all()).results;
  const duplicates=(await db.prepare("SELECT external_id FROM movie_external_ids WHERE provider='tmdb' GROUP BY external_id HAVING count(*)>1").all()).results;
  const preserved=original.every(e=>after.movies.find(m=>m.id===e.movie_id)?.external_ids.some(i=>i.provider==='tmdb'&&i.external_id===e.external_id));
  const service=new MovieService(repo,{DB:db} as Env);
  let exposed=true;
  for(const p of manifest.pairings.filter(p=>report.accepted.some(a=>(a as {movie_id:string}).movie_id===p.movie_id))){const catalog=after.movies.find(m=>m.id===p.movie_id)!;const detail=await service.detail(p.movie_id);if(!catalog.tmdb_metadata_checked_at||!catalog.tmdb_artwork_checked_at||JSON.stringify({...detail,appearances:undefined})!==JSON.stringify(catalog))exposed=false;}
  report.verification={integrity,fks,duplicate_tmdb_ids:duplicates,original_identities_preserved:preserved,count_delta_correct:unidentified-report.remaining_without_tmdb===report.accepted.length,catalogue_detail_metadata_artwork:exposed};
  await options.save(report);
  if(fks.length||duplicates.length||!preserved||!report.verification.count_delta_correct||!exposed||integrity.some(row=>Object.values(row)[0]!=='ok'))throw new Error('Local post-apply verification failed; inspect ignored report.');
  return report;
}
