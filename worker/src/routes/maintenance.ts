import { UnifiedMaintenanceService } from '../unified-maintenance';
import { CollectionRosterService } from '../collection-roster-service';
import { z } from 'zod';
import { unifiedMaintenanceSchema } from '../validation';
import { json } from '../http';
import { titleReconcileSchema, selectedMetadataSchema, maintenanceSchema, enrichmentSchema, idSchema } from '../validation';
import { ScoreService } from '../score-service';
import { EnrichmentService } from '../enrichment-service';
import { TitleRepository } from '../title-repository';
import { providerEnrichmentSchema } from '../validation';

import { requireAdmin } from '../product-repository';

import type { RouteContext } from './context';
import { MaintenanceJobs } from '../maintenance-jobs';
import { maintenanceOperations } from '../../../shared/maintenance-plan';
import { ApiError } from '../http';
import { maintenanceJobDatabase } from '../maintenance-job-db';
import { Repository } from '../repository';
import { MovieService } from '../services';

export async function maintenanceRoutes(context:RouteContext):Promise<Response|undefined>{
  const {path,method,env,request,auth,body}=context;
  if(path==='/api/v1/maintenance/jobs' || path.startsWith('/api/v1/maintenance/jobs/')){
    requireAdmin(auth.viewer);const jobs=new MaintenanceJobs(env);
    if(path==='/api/v1/maintenance/jobs/import'&&method==='POST'){
      const input=z.object({id:z.uuid(),intent:z.enum(['populate','refresh']),operation:z.enum([...maintenanceOperations,'all','collection-rosters']),startedAt:z.iso.datetime(),phase:z.enum(['films','collections']),filmOnly:z.boolean(),rosterStartedAt:z.iso.datetime().nullable(),units:z.array(z.tuple([idSchema,z.enum(['mdblist','omdb','tmdb']),z.enum(['imdb','tmdb']),z.string().regex(/^(tt\d{7,10}|[1-9]\d{0,9})$/),z.array(z.enum(maintenanceOperations)).min(1).max(4),z.array(z.string().max(40)).max(9)])).max(3000),collections:z.array(z.number().int().positive().max(2147483647)).max(3000)}).strict().parse(await body(request));
      return json(await jobs.create(input.id,input.intent,input.operation,input));
    }
    if(path==='/api/v1/maintenance/jobs'){
      if(method==='GET'){const after=new URL(request.url).searchParams.get('after');return json(await jobs.list(after===null?null:z.uuid().parse(after)));}
      if(method==='POST'){const input=z.object({id:z.uuid(),intent:z.enum(['populate','refresh']),operation:z.enum([...maintenanceOperations,'all','collection-rosters'])}).strict().parse(await body(request));return json(await jobs.create(input.id,input.intent,input.operation));}
    }
    const match=path.match(/^\/api\/v1\/maintenance\/jobs\/([^/]+)(?:\/(claim|step|release|stop|retry))?$/);
    if(match){const id=z.uuid().parse(match[1]),action=match[2];
      if(!action && method==='GET'){const after=new URL(request.url).searchParams.get('after');return json(await jobs.status(id,after===null?null:z.string().max(200).parse(after)));}
      if(method==='POST'){
        if(action==='claim'){z.object({}).strict().parse(await body(request));return json(await jobs.claim(id,auth.viewer!.display_name));}
        if(action==='step'||action==='release'){const input=z.object({token:z.uuid()}).strict().parse(await body(request));return json(action==='step'?await jobs.step(id,input.token):await jobs.release(id,input.token));}
        if(action==='stop'){z.object({}).strict().parse(await body(request));return json(await jobs.stop(id));}
        if(action==='retry'){const input=z.object({keys:z.array(z.string().min(1).max(200)).min(1).max(10).optional()}).strict().parse(await body(request));return json(await jobs.retry(id,input.keys));}
      }
    }
    throw new ApiError(405,'METHOD_NOT_ALLOWED','Maintenance job method not supported.');
  }
  const legacyWrite=method==='POST' && (path==='/api/v1/collections/maintenance'||path==='/api/v1/classics/enrich'||/^\/api\/v1\/movies\/(maintenance-provider|reconcile-titles|maintain|enrich-provider-selected|enrich-metadata-selected|enrich-metadata|[^/]+\/refresh-scores)$/.test(path));
  if(!legacyWrite || !await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance_lease'").first())return legacyMaintenanceRoutes(context);
  requireAdmin(auth.viewer);
  const token=crypto.randomUUID(),id=`legacy:${token}`;
  const lease=await env.DB.prepare('UPDATE maintenance_lease SET job_id=?,owner=?,token=?,execution=?,expires_at=? WHERE slot=1 AND expires_at<=? RETURNING slot').bind(id,auth.viewer!.display_name,token,token,Date.now()+180000,Date.now()).first();
  if(!lease)throw new ApiError(409,'MAINTENANCE_BUSY','Another browser owns maintenance execution.');
  const db=maintenanceJobDatabase(env.DB,id,token,token),guardedEnv={...env,DB:db},repo=new Repository(db);
  try{return await legacyMaintenanceRoutes({...context,env:guardedEnv,repo,movies:new MovieService(repo,guardedEnv)});}
  finally{await env.DB.prepare('UPDATE maintenance_lease SET expires_at=0,execution=NULL WHERE slot=1 AND token=?').bind(token).run();}
}

async function legacyMaintenanceRoutes({request,env,path,method,repo,movies,auth,body}: RouteContext): Promise<Response | undefined> {
  if(path==='/api/v1/collections/maintenance' && method==='GET') {requireAdmin(auth.viewer);return json(await new CollectionRosterService(env).status());}
  if(path==='/api/v1/collections/maintenance' && method==='POST') {
    requireAdmin(auth.viewer);
    const input=z.object({intent:z.enum(['populate','refresh']),startedAt:z.iso.datetime(),ids:z.array(z.number().int().positive().max(2147483647)).min(1).max(2).refine(ids=>new Set(ids).size===ids.length)}).strict().parse(await body(request));
    return json(await new CollectionRosterService(env).execute(input.intent,input.ids,input.startedAt));
  }
  if(path==='/api/v1/movies/maintenance-coverage' && method==='GET') {
    requireAdmin(auth.viewer);const after=new URL(request.url).searchParams.get('after');
    return json(await new UnifiedMaintenanceService(repo,env).status(after===null?null:idSchema.parse(after)));
  }
  if(path==='/api/v1/movies/maintenance-provider' && method==='POST') {
    requireAdmin(auth.viewer);const input=unifiedMaintenanceSchema.parse(await body(request));
    return json(await new UnifiedMaintenanceService(repo,env).execute(input.intent,input.units,input.startedAt));
  }
  if (path === '/api/v1/movies/title-authority' && method === 'GET') { requireAdmin(auth.viewer); return json(await new TitleRepository(env.DB).status()); }
  if (path === '/api/v1/movies/reconcile-titles' && method === 'POST') {
    requireAdmin(auth.viewer);
    const input=titleReconcileSchema.parse(await body(request));
    return json(await new TitleRepository(env.DB).reconcileBatch(input.after ?? null));
  }
  if (path === '/api/v1/movies/maintenance-status' && method === 'GET') { requireAdmin(auth.viewer); return json(await repo.scoreMaintenanceStatus()); }
  if (path === '/api/v1/movies/maintain' && method === 'POST') {
    requireAdmin(auth.viewer);
    const input = maintenanceSchema.parse(await body(request));
    return json(await new ScoreService(repo,env).maintain(input.mode,input.movie_ids));
  }
  if (path === '/api/v1/movies/enrich-provider-selected' && method === 'POST') {
    requireAdmin(auth.viewer);
    const input=providerEnrichmentSchema.parse(await body(request));
    return json(await new EnrichmentService(repo,env).maintain(input.provider,input.movie_ids));
  }
  if (path === '/api/v1/classics/enrich' && method === 'POST') {
    requireAdmin(auth.viewer);
    const input = enrichmentSchema.parse(await body(request)); return json(await new ScoreService(repo,env).enrich(input.limit));
  }
  if (path === '/api/v1/movies/enrich-metadata-selected' && method === 'POST') {
    requireAdmin(auth.viewer);
    return json(await movies.enrichMetadataSelected(selectedMetadataSchema.parse(await body(request)).movie_ids));
  }
  if (path === '/api/v1/movies/enrich-metadata' && method === 'POST') {
    requireAdmin(auth.viewer);
    return json(await movies.enrichMetadata(enrichmentSchema.parse(await body(request)).limit));
  }
  const refreshMatch = path.match(/^\/api\/v1\/movies\/([^/]+)\/refresh-scores$/);
  if (refreshMatch && method === 'POST') { requireAdmin(auth.viewer); return json(await new ScoreService(repo,env).refresh(idSchema.parse(refreshMatch[1]))); }
  return undefined;
}
