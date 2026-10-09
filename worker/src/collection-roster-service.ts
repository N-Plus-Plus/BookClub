import type { CollectionRosterBatch, CollectionRosterStatus } from '../../shared/collection-roster';
import { CollectionRosterRepository } from './collection-roster-repository';
import type { Env } from './http';
import { ApiError } from './http';
import { Repository } from './repository';
import { TmdbProvider } from './providers/tmdb';
import { executeProvider, quotaCooldown } from './providers/execution';
import { ProviderError } from './providers/http';

export class CollectionRosterService {
  private store:CollectionRosterRepository;
  private repo:Repository;
  constructor(private env:Env){this.store=new CollectionRosterRepository(env.DB);this.repo=new Repository(env.DB);}
  async status():Promise<CollectionRosterStatus>{
    await this.store.requireSchema();
    const wait=await this.repo.providerCooldown('tmdb',true);
    return {collections:(await this.store.eligible()).map(({id,name,films,checked_at})=>({id,name,films,checked_at})),unavailable:!this.env.TMDB_READ_TOKEN?'TMDB is not configured.':wait!==null?'TMDB is cooling down. Try later.':null};
  }
  async execute(intent:'populate'|'refresh',ids:number[],startedAt:string):Promise<CollectionRosterBatch>{
    await this.store.requireSchema();
    if(!this.env.TMDB_READ_TOKEN)throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','TMDB is not configured.');
    const candidates=new Map((await this.store.eligible()).map(c=>[c.id,c]));
    const response:CollectionRosterBatch={results:[],requests:0,cacheChanged:false};let exhausted=false;
    const provider=new TmdbProvider(this.env.TMDB_READ_TOKEN,async headers=>{
      const remaining=headers.get('X-RateLimit-Remaining');
      if(remaining!==null && Number(remaining)<=0){exhausted=true;await this.repo.setProviderCooldown('tmdb',quotaCooldown(headers));}
    });
    for(const id of new Set(ids)){
      const candidate=candidates.get(id);
      if(!candidate || candidate.checked_at && (intent==='populate' || candidate.checked_at>=startedAt)){
        response.results.push({id,status:'skipped',message:'Already checked or no longer eligible.'});continue;
      }
      try{
        const roster=await executeProvider(this.repo,'tmdb',()=>{response.requests++;return provider.collectionDetails(id);},{provider:'TMDB'});
        if(!roster || !candidate.memberIds.every(member=>roster.parts.some(part=>part.id===member)))throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','TMDB collection membership was incomplete or malformed. Previous evidence is preserved.');
        await this.store.save(roster);response.cacheChanged=true;response.results.push({id,status:'checked',message:'Collection membership checked.'});
      }catch(error){
        const malformed=error instanceof ApiError && error.code==='INVALID_PROVIDER_RESPONSE';
        await this.store.failure(id,malformed?'inconclusive':'failed');
        response.cacheChanged=true;
        response.results.push({id,status:'failed',message:error instanceof ApiError?error.message:'Collection check failed. Previous evidence is preserved.'});
        if(error instanceof ProviderError && error.kind!=='not_found' || !(error instanceof ApiError)){response.stopped='Collection maintenance interrupted. Resume the remaining checks.';break;}
      }
      if(exhausted){response.stopped='TMDB quota reached. Resume after the cooldown.';break;}
    }
    return response;
  }
}
