import { z } from 'zod';
import { titleKey, type IdentityEvidence } from './resolution.ts';
import type { ResolvedPlan } from './model.ts';
import { ImportError } from './io.ts';
const candidateSchema=z.object({id:z.number().int().positive(),title:z.string().min(1).max(300),original_title:z.string().optional(),release_date:z.string().optional(),imdb_id:z.string().regex(/^tt\d{7,10}$/).nullable().optional()});
export type Candidate=z.infer<typeof candidateSchema>;
const entrySchema=z.object({status:z.enum(['success','temporary-failure']),candidates:z.array(candidateSchema),complete:z.boolean(),retryAt:z.number().optional(),message:z.string().optional()}).strict();
export const cacheSchema=z.object({version:z.literal(1),entries:z.record(z.string(),entrySchema)}).strict();
export type ResolutionCache=z.infer<typeof cacheSchema>;
export function requestFor(movie:ResolvedPlan['movies'][number]) {
  const imdb=movie.external_ids.find(e=>e.provider==='imdb')?.external_id, tmdb=movie.external_ids.find(e=>e.provider==='tmdb')?.external_id;
  if(imdb) return {key:`imdb:${imdb}`,path:`find/${imdb}?external_source=imdb_id`,mode:'imdb' as const};
  if(tmdb) return {key:`tmdb:${tmdb}`,path:`movie/${tmdb}?append_to_response=external_ids`,mode:'tmdb' as const};
  return {key:`title:${titleKey(movie.title)}:${movie.year??''}`,path:`search/movie?query=${encodeURIComponent(movie.title)}&include_adult=false${movie.year===null?'':`&year=${movie.year}`}`,mode:'title' as const};
}
export async function resolveWithTmdb(plan:ResolvedPlan, options:{token?:string;maxRequests?:number;cache?:ResolutionCache;fetcher?:typeof fetch;save?:(cache:ResolutionCache)=>Promise<void>;now?:()=>number}) {
  const cache=options.cache??{version:1,entries:{}}, cap=options.maxRequests??25;
  if(!Number.isInteger(cap)||cap<0||cap>1000) throw new ImportError('max-requests must be an integer from 0 to 1000.');
  const fetcher=options.fetcher??fetch,now=options.now??Date.now;
  let requests=0, cacheHits=0, remaining=0, halted=Object.values(cache.entries).some(e=>e.status==='temporary-failure'&&(e.retryAt??0)>now());
  const evidence:IdentityEvidence[]=[], review:{source_refs:string[];candidates:Candidate[];reason:string}[]=[];
  for(const movie of plan.movies) {
    const request=requestFor(movie);let entry:z.infer<typeof entrySchema>|undefined=cache.entries[request.key];
    if(entry?.status==='temporary-failure' && (entry.retryAt??0)<=now()) entry=undefined;
    if(entry) cacheHits++;
    if(!entry) {
      if(!options.token||requests>=cap||halted) {remaining++;continue;}
      requests++;
      try {
        const response=await fetcher(`https://api.themoviedb.org/3/${request.path}`,{headers:{Authorization:`Bearer ${options.token}`,Accept:'application/json'},signal:AbortSignal.timeout(8000)});
        if(!response.ok) {
          const retry=response.headers.get('Retry-After'),seconds=retry&&/^\d+$/.test(retry)?Math.min(3600,Number(retry)):60;
          entry={status:'temporary-failure',candidates:[],complete:false,retryAt:now()+seconds*1000,message:response.status===429?'TMDB rate limit; resume later.':'TMDB temporarily unavailable; resume later.'};halted=true;
        } else {
          const payload:unknown=await response.json();
          const schema=request.mode==='imdb'?z.object({movie_results:z.array(candidateSchema)}):request.mode==='tmdb'?candidateSchema.extend({external_ids:z.object({imdb_id:z.string().regex(/^tt\d{7,10}$/).nullable().optional()}).optional()}):z.object({results:z.array(candidateSchema),total_pages:z.number().int().nonnegative(),page:z.literal(1)});
          const parsed=schema.safeParse(payload); if(!parsed.success) throw new Error('unsafe response');
          const d=parsed.data;
          const candidates='movie_results' in d?d.movie_results:'results' in d?d.results:[{...d,imdb_id:d.external_ids?.imdb_id}];
          entry={status:'success',candidates,complete:!('total_pages' in d)||d.total_pages<=1};
        }
      } catch {entry={status:'temporary-failure',candidates:[],complete:false,retryAt:now()+60000,message:'TMDB request or response unavailable; resume later.'};halted=true;}
      cache.entries[request.key]=entry;await options.save?.(cache);
    }
    if(entry.status!=='success') {remaining++;continue;}
    const exact=request.mode==='title'?entry.candidates.filter(c=>(titleKey(c.title)===titleKey(movie.title)||c.original_title&&titleKey(c.original_title)===titleKey(movie.title))&&(movie.year===null||Number(c.release_date?.slice(0,4))===movie.year)):entry.candidates;
    const chosen=entry.complete&&exact.length===1?exact[0]:undefined;
    if(chosen) {
      const release=chosen.release_date?.match(/^\d{4}-\d{2}-\d{2}$/), year=release?Number(chosen.release_date!.slice(0,4)):null;
      if(year!==null&&(year<1870||year>2200)) {review.push({source_refs:movie.source_refs,candidates:entry.candidates,reason:'Invalid release year; review.'});continue;}
      evidence.push({source_refs:movie.source_refs,tmdb_id:String(chosen.id),title:chosen.title,year,imdb_id:request.mode==='imdb'?movie.external_ids.find(e=>e.provider==='imdb')!.external_id:chosen.imdb_id});
    } else review.push({source_refs:movie.source_refs,candidates:entry.candidates,reason:entry.complete?exact.length?'Multiple exact identities; review.':'No exact identity found; provisional source retained.':'Search spans multiple pages; uniqueness cannot be proven.'});
  }
  return {evidence,cache,review,state:{networkAvailable:Boolean(options.token),requests,cacheHits,remaining,moreWorkRemains:remaining>0}};
}
