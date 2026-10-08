import { matchingCheck, planMaintenance, providerIdentity, providerKeys, type MaintenanceBatchResult, type MaintenanceIntent, type MaintenanceUnit, type MaintenanceCoverage } from '../../shared/maintenance-plan';
import { missingLiveScoreDimensions, requiredScores } from '../../shared/ranking';
import type { Movie, Score } from '../../shared/types';
import { ApiError, type Env } from './http';
import type { Repository } from './repository';
import { CoverageRepository } from './coverage-repository';
import { executeProvider, quotaCooldown } from './providers/execution';
import { TmdbProvider } from './providers/tmdb';
import { MdbListProvider } from './providers/mdblist';
import { OmdbCredentials } from './providers/omdb-credentials';
import { ProviderError, rateLimitHeaders } from './providers/http';
import { MDBLIST_QUOTA_RESERVE } from './enrichment-service';

/** Each bounded request owns one provider; its validated response feeds the existing destination owners. */
export class UnifiedMaintenanceService {
  private coverage:CoverageRepository;
  constructor(private repo:Repository,private env:Env) {this.coverage=new CoverageRepository(env.DB);}
  async status(after:string | null) {
    const page=await this.coverage.page(after);
    return {...await this.coverage.read(this.repo,this.env,page.ids),next:page.next};
  }
  private async scoreEvidence(movie:Movie,unit:MaintenanceUnit,scores:Score[],coverage:MaintenanceCoverage,intent:MaintenanceIntent,startedAt:string) {
    await this.repo.appendScores(movie.id,scores,unit.identity);
    const absent=providerKeys[unit.provider].filter(key=>missingLiveScoreDimensions(scores).includes(key));
    await this.coverage.save(movie.id,unit.provider,'scores',unit.identity,[...absent]);
    // Clear negatives for incidental supported scores only after snapshots are committed.
    const present=requiredScores.filter(key=>!missingLiveScoreDimensions(scores).includes(key));
    await this.repo.saveScoreChecks(movie.id,present.map(key=>({key,available:true})));
    const current=await this.coverage.read(this.repo,this.env,[movie.id]);
    const missing=missingLiveScoreDimensions([...movie.scores.filter(s=>intent==='populate' || Date.parse(s.fetched_at)>=Date.parse(startedAt)),...scores]);
    const checks=missing.filter(key=>{
      const paths=(['mdblist','omdb','tmdb'] as const).filter(provider=>providerKeys[provider].includes(key) && providerIdentity(movie,provider));
      return paths.length && paths.every(provider=>{const check=matchingCheck(current,movie.id,provider,'scores',providerIdentity(movie,provider)!);return check?.absent.includes(key) && (intent==='populate' || Date.parse(check.checked_at)>=Date.parse(startedAt));});
    });
    await this.repo.saveScoreChecks(movie.id,checks.map(key=>({key,available:false})));
    Object.assign(coverage,current);
  }
  async execute(intent:MaintenanceIntent,units:MaintenanceUnit[],startedAt:string):Promise<MaintenanceBatchResult> {
    if(!units.length || new Set(units.map(u=>u.provider)).size!==1 || units.length>(units[0].provider==='tmdb'?2:10)
      || new Set(units.map(u=>u.movieId)).size!==units.length) throw new ApiError(422,'INVALID_LIMIT','Choose one bounded provider batch.');
    const movies=await this.repo.maintenanceDetails(units.map(u=>u.movieId));
    const coverage=await this.coverage.read(this.repo,this.env,units.map(u=>u.movieId));
    if(units.some(u=>u.operations.includes('tmdb-collections') || u.operations.includes('omdb-awards')) && !coverage.evidenceSupported) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Collections and awards maintenance requires migration 0021.');
    // Scope validation is still owned by the selected-film loader.
    const scoreIds=units.filter(u=>u.operations.includes('scores')).map(u=>u.movieId);
    if(scoreIds.length) await this.repo.maintenanceDetails(scoreIds,true);
    const response:MaintenanceBatchResult={results:[],canonicalChanged:false,cacheChanged:false,requests:0};
    const provider=units[0].provider;
    const limits=async(headers:Headers)=>{
      response.quota=rateLimitHeaders(headers);
      const remaining=headers.get('X-RateLimit-Remaining');
      if(remaining!==null && /^\d+$/.test(remaining) && Number(remaining)<=(provider==='mdblist'?MDBLIST_QUOTA_RESERVE:0)) {
        await this.repo.setProviderCooldown(provider,quotaCooldown(headers));response.stopped=true;
      }
    };
    const call=<T,>(work:()=>Promise<T>)=>executeProvider(this.repo,provider,()=>{response.requests!++;return work();},{onFailure:error=>{if(error.rateLimit)response.quota=error.rateLimit;}});
    const fail=async(unit:MaintenanceUnit,error:unknown)=>{
      await this.coverage.failure(unit.movieId,provider,unit.operations,true);
      const blocking=!(error instanceof ProviderError && error.kind==='not_found');
      response.results.push({movieId:unit.movieId,provider,status:'failed',blocking,message:error instanceof ApiError ? error.message : 'Provider work could not be saved. Completed results are retained.',...(error instanceof ProviderError && error.retryAfter!==undefined?{retryAfter:error.retryAfter}:{})});
      response.stopped ||= blocking;
    };
    const pending:MaintenanceUnit[]=[];
    for(const unit of units) {
      const movie=movies.find(m=>m.id===unit.movieId)!;
      const identity=providerIdentity(movie,provider);
      if(!identity || identity.provider!==unit.identity.provider || identity.external_id!==unit.identity.external_id) {await fail(unit,new ApiError(409,'IDENTITY_CONFLICT','Stored provider identity changed. Replan before resuming.'));continue;}
      if(coverage.unavailable[provider]) {await fail(unit,new ApiError(503,'PROVIDER_UNAVAILABLE',coverage.unavailable[provider]!));continue;}
      let operations=unit.operations;
      if(intent==='populate') {
        const planned=planMaintenance({movies:[movie],members:[],sessions:[],cycles:[]},coverage,intent,operations.filter(o=>o!=='scores')).units;
        operations=operations.filter(o=>o==='scores' || planned.some(p=>p.provider===provider && p.operations.includes(o)));
      }
      if(operations.includes('scores') && provider!=='mdblist') {
        const baseline=intent==='refresh' ? movie.scores.filter(s=>Date.parse(s.fetched_at)>=Date.parse(startedAt)) : movie.scores;
        const missing=missingLiveScoreDimensions(baseline).filter(key=>intent==='refresh' || !coverage.negativeScores.some(c=>c.movie_id===movie.id && c.score_key===key));
        const prior=matchingCheck(coverage,movie.id,provider,'scores',unit.identity);
        if(!providerKeys[provider].some(key=>missing.includes(key) && (intent==='refresh' || !prior?.absent.includes(key)))) operations=operations.filter(o=>o!=='scores');
      }
      if(!operations.length) response.results.push({movieId:unit.movieId,provider,status:'skipped',message:'No outstanding provider work.'});
      else pending.push({...unit,operations});
    }
    if(response.stopped) return response;
    const omdb=new OmdbCredentials(this.repo,this.env,identity=>async headers=>{
      response.quota=rateLimitHeaders(headers);
      if(headers.get('X-RateLimit-Remaining')==='0') await this.repo.setProviderCooldown(identity,quotaCooldown(headers));
    },()=>{response.requests!++;});
    const cacheChanges=new Map<string,boolean>();
    const fingerprint=(movie:Pick<Movie,'title'|'original_title'|'release_date'|'runtime'|'overview'|'director'|'genres'|'assets'>)=>JSON.stringify([movie.title,movie.original_title,movie.release_date,movie.runtime,movie.overview,movie.director,[...movie.genres].sort(),movie.assets.map(a=>[a.provider,a.asset_type,a.reference,a.preferred]).sort()]);
    const saveCache=async(movieId:string,capture:import('../../shared/enrichment').EnrichmentCapture | undefined,required:boolean)=>{
      if(!capture) {if(required) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','Provider returned incomplete enrichment. Existing cache is preserved.');return 0;}
      const saved=await this.repo.cacheEnrichment(movieId,capture);
      response.canonicalChanged ||= saved.canonicalChanged;response.cacheChanged ||= saved.changed;cacheChanges.set(movieId,saved.changed);
      return saved.conflicts;
    };
    if(provider==='mdblist') {
      const captures=new Map<string,import('../../shared/enrichment').EnrichmentCapture | undefined>();
      const titles=new Map<string,string | null>();
      const mdb=new MdbListProvider(this.env.MDBLIST_API_KEY!,limits,async(identity,capture,title)=>{captures.set(identity.external_id,capture);titles.set(identity.external_id,title);});
      for(const family of ['imdb','tmdb']) {
        const group=pending.filter(u=>u.identity.provider===family);if(!group.length || response.stopped) continue;
        let result:Map<string,Score[]>;
        try {result=await call(()=>mdb.batch(family,group.map(u=>u.identity.external_id)));}
        catch(error) {for(const u of group)await fail(u,error);break;}
        for(const unit of group) {
          try {
            let scores=result.get(unit.identity.external_id);
            // Keep the established single-film recovery bound; never replay the batch.
            if(scores===undefined && !response.stopped) scores=await call(()=>mdb.scores(unit.identity));
            if(scores===undefined) throw new ApiError(503,'INCOMPLETE_BATCH','Film omitted from provider batch; retained for resume.');
            const movie=movies.find(m=>m.id===unit.movieId)!;
            if(unit.operations.includes('scores')) {await this.scoreEvidence(movie,unit,scores,coverage,intent,startedAt);response.canonicalChanged ||= scores.length>0;}
            const conflicts=await saveCache(movie.id,captures.get(unit.identity.external_id),unit.operations.includes('mdblist-enrichment'));
            if(!captures.get(unit.identity.external_id) && titles.get(unit.identity.external_id)) {await this.repo.cacheProviderTitle(movie.id,provider,titles.get(unit.identity.external_id),unit.identity,new Date().toISOString());response.canonicalChanged=true;}
            await this.coverage.failure(movie.id,provider,unit.operations,false);
            response.results.push({movieId:movie.id,provider,status:scores.length && unit.operations.includes('scores') || cacheChanges.get(movie.id)?'updated':'no_change',message:'Validated provider information saved.',conflicts});
          } catch(error) {await fail(unit,error);}
        }
      }
    } else for(const unit of pending) {
      const movie=movies.find(m=>m.id===unit.movieId)!;
      try {
        let scores:Score[]=[],conflicts=0,changed=false,evidenceValid=false;
        if(provider==='omdb') {
          const detail=await omdb.details(unit.identity.external_id);scores=detail.scores;
          evidenceValid=Boolean(detail.awards);changed=await this.repo.cacheAwards(movie.id,detail.awards);response.cacheChanged ||= changed;
          // Score fallback retains canonical fill behaviour without overwriting populated fields in Populate.
          const metadataChanged=await this.repo.enrichOmdbMetadata(movie.id,unit.identity.external_id,detail.metadata,intent==='populate');
          changed ||= metadataChanged;response.canonicalChanged ||= metadataChanged;

        } else {
          const detail=await call(()=>new TmdbProvider(this.env.TMDB_READ_TOKEN!,limits).details(unit.identity.external_id));scores=detail.scores;
          evidenceValid=Boolean(detail.collection);changed=await this.repo.cacheCollection(movie.id,detail.collection);response.cacheChanged ||= changed;
          if(unit.operations.includes('scores')) {await this.scoreEvidence(movie,unit,scores,coverage,intent,startedAt);response.canonicalChanged ||= scores.length>0;}
          if(unit.operations.includes('tmdb-metadata')) {
            const cached=await this.repo.enrichMetadata(movie.id,unit.identity.external_id,{...detail,collection:undefined},undefined,false,intent);
            const metadataChanged=fingerprint(movie)!==fingerprint((await this.repo.selectedMetadataMovies([movie.id]))[0]);
            changed ||= metadataChanged;
            response.canonicalChanged ||= metadataChanged || Boolean(cached?.canonicalChanged);response.cacheChanged ||= Boolean(cached?.changed);changed ||= Boolean(cached?.changed);
            if(unit.operations.includes('tmdb-enrichment') && !detail.enrichment) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','TMDB enrichment is incomplete. Canonical results are saved.');

          } else {conflicts=await saveCache(movie.id,detail.enrichment,unit.operations.includes('tmdb-enrichment'));changed ||= Boolean(cacheChanges.get(movie.id));}
        }
        if(provider==='omdb' && unit.operations.includes('scores')) {await this.scoreEvidence(movie,unit,scores,coverage,intent,startedAt);response.canonicalChanged ||= scores.length>0;}
        if(unit.operations.includes('tmdb-collections') && !evidenceValid) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','TMDB collection evidence is incomplete. Valid results are retained.');
        if(unit.operations.includes('omdb-awards') && !evidenceValid) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','OMDb awards evidence is incomplete. Valid results are retained.');
        await this.coverage.failure(movie.id,provider,unit.operations,false);
        response.results.push({movieId:movie.id,provider,status:changed || scores.length && unit.operations.includes('scores')?'updated':'no_change',message:'Validated provider information saved.',conflicts});
      } catch(error) {await fail(unit,error);}
      if(response.stopped) break;
    }
    return response;
  }
}
