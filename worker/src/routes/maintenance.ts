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

export async function maintenanceRoutes({request,env,path,method,repo,movies,auth,body}: RouteContext): Promise<Response | undefined> {
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
