import type { MaintenanceFailure } from '../../shared/maintenance-failure';
import { ApiError } from './http';
import { ProviderError } from './providers/http';
import { RatingError } from './providers/ratings';

/** Unknown persistence/runtime errors stop execution; only known constraints are isolated. */
export function classifyMaintenanceFailure(error: unknown): MaintenanceFailure {
  if(error instanceof RatingError)return {category:'record',message:error.message};
  if (error instanceof ProviderError) {
    return {category:['not_found','malformed'].includes(error.kind)?'record':['network','outage'].includes(error.kind)?'transient':'provider',message:error.message,...(error.retryAfter===undefined?{}:{retryAfter:error.retryAfter})};
  }
  if (error instanceof ApiError) {
    if (['INVALID_PROVIDER_RESPONSE','IDENTITY_CONFLICT','INCOMPLETE_BATCH','INVALID_MOVIES','NOT_FOUND'].includes(error.code)) return {category:'record',message:error.message};
    if (['PROVIDER_UNAVAILABLE','PROVIDER_NOT_CONFIGURED','PROVIDER_RATE_LIMITED'].includes(error.code)) return {category:'provider',message:error.message};
    return {category:'systemic',message:'Maintenance paused because application persistence or authorization is unavailable.'};
  }
  // D1 constraints are record-local; missing tables, busy/unavailable storage and unknown
  // trigger failures are deliberately excluded. Never expose the SQL-bearing error.
  if (error instanceof Error && /(?:UNIQUE|NOT NULL|CHECK|FOREIGN KEY) constraint failed/i.test(error.message)) return {category:'record',message:'This record could not be saved because its stored data conflicts with a constraint.'};
  return {category:'systemic',message:'Maintenance paused because reliable persistence could not be confirmed.'};
}

/** One retry for transport/5xx, never persistence, malformed data or quota failures. */
export async function maintenanceRequest<T>(work:()=>Promise<T>,cooldown:()=>Promise<void>):Promise<T>{
  try{return await work();}catch(error){if(classifyMaintenanceFailure(error).category!=='transient')throw error;}
  try{return await work();}catch(error){if(classifyMaintenanceFailure(error).category==='transient')await cooldown();throw error;}
}
