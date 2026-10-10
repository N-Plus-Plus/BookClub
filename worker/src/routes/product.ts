import type { JournalMutationResult } from '../../../shared/types';
import { ApiError, json } from '../http';
import { idSchema, sessionSchema } from '../validation';

import { requireAdmin, requireViewer } from '../product-repository';
import { avatarSchema, builderSchema, publishSchema, revisionSchema, rotationSchema } from '../validation';
import type { RouteContext } from './context';
import { PredictionRepository } from '../prediction-repository';
import { z } from 'zod';

export async function productRoutes({request,path,method,repo,product,auth,body,env}: RouteContext): Promise<Response | undefined> {
  const predictions=new PredictionRepository(env.DB);
  if (path === '/api/v1/auth/preferences') {
    const actor=requireViewer(auth.viewer);
    if (method === 'GET') return json(await predictions.preference(actor.id));
    if (method === 'PUT') return json(await predictions.setPreference(actor.id,z.object({show_ai:z.boolean()}).strict().parse(await body(request)).show_ai));
  }
  if (path === '/api/v1/predictions') {
    if (method === 'GET') { requireViewer(auth.viewer); return json(await predictions.list()); }
    if (method === 'POST' || method === 'DELETE') {
      requireAdmin(auth.viewer);
      const input=z.object({member_id:idSchema,movie_id:idSchema}).strict().parse(await body(request));
      return json(await (method === 'POST' ? predictions.add(input.member_id,input.movie_id) : predictions.remove(input.member_id,input.movie_id)));
    }
  }
  const exportMatch=path.match(/^\/api\/v1\/participants\/([^/]+)\/history-export$/);
  if (exportMatch && method === 'GET') { requireAdmin(auth.viewer); return json(await predictions.exportHistory(idSchema.parse(exportMatch[1]))); }
  if (path === '/api/v1/avatars' && method === 'GET') { requireViewer(auth.viewer); return json(await product.availableAvatars()); }
  if (path === '/api/v1/auth/avatar' && method === 'POST') return json(await product.claimAvatar(requireViewer(auth.viewer),avatarSchema.parse(await body(request)).avatar));
  if (path === '/api/v1/rotation' && method === 'GET') return json(await product.rotation());
  if (path === '/api/v1/rotation/swap' && method === 'POST') {
    const actor = requireAdmin(auth.viewer); return json(await product.swapRotation(actor,rotationSchema.parse(await body(request))));
  }
  const builderMatch = path.match(/^\/api\/v1\/builders\/([^/]+)(?:\/(publish))?$/);
  if (path === '/api/v1/builders' || builderMatch) {
    const actor = requireViewer(auth.viewer), id = builderMatch ? idSchema.parse(builderMatch[1]) : undefined;
    if (!id && method === 'GET') return json(await product.builders(actor.id));
    if (!id && method === 'POST') return json(await product.saveBuilder(actor.id,builderSchema.parse(await body(request))),201);
    if (id && builderMatch?.[2] === 'publish' && method === 'POST') {
      const {revision,...input} = publishSchema.parse(await body(request));
      const result: JournalMutationResult = {};
      const sessionId = await product.publishBuilder(actor,id,revision,{...input,movie_ids: [],date_precision: 'exact'},result);
      result.session = await repo.session(sessionId);
      return json(result,201);
    }
    if (id && !builderMatch?.[2]) {
      if (method === 'GET') return json(await product.builder(actor.id,id));
      if (method === 'PUT') return json(await product.saveBuilder(actor.id,builderSchema.parse(await body(request)),id,true));
      if (method === 'DELETE') { await product.deleteBuilder(actor.id,id,revisionSchema.parse(await body(request)).revision); return json({deleted: true}); }
    }
    throw new ApiError(404,'NOT_FOUND','API route not found.');
  }
  const historyAction = path.match(/^\/api\/v1\/sessions\/([^/]+)\/(audit|restore)$/);
  if (historyAction) {
    const id = idSchema.parse(historyAction[1]);
    if (historyAction[2] === 'audit' && method === 'GET') { requireAdmin(auth.viewer); return json(await product.auditTrail(id)); }
    if (historyAction[2] === 'restore' && method === 'POST') { await product.restoreSession(requireAdmin(auth.viewer),id); return json({session:await repo.session(id)} satisfies JournalMutationResult); }
  }
  const sessionMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);
  if (sessionMatch && method === 'DELETE') { await product.deleteSession(auth.viewer,idSchema.parse(sessionMatch[1])); return json({removedSessionId:sessionMatch[1]} satisfies JournalMutationResult); }
  if ((path === '/api/v1/sessions' && method === 'POST') || (sessionMatch && method === 'PUT')) {
    const input = sessionSchema.parse(await body(request));
    const result: JournalMutationResult = {};
    const id = await product.saveSession(input,auth.viewer,sessionMatch ? idSchema.parse(sessionMatch[1]) : undefined,undefined,result);
    result.session = await repo.session(id);
    return json(result,sessionMatch ? 200 : 201);
  }
  return undefined;
}
