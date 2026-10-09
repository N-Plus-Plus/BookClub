/** TMDB collection evidence is independent of canonical film ownership. */
export interface CollectionPart { id:number; title:string | null; release_date:string | null }
export interface CollectionRoster { id:number; name:string; checked_at:string; parts:CollectionPart[] }
export interface CollectionRosterEvidence {
  status:'checked'|'not_checked'|'inconclusive'|'failed';
  roster:CollectionRoster | null;
  attempted_at:string | null;
}
export interface CollectionRosterCandidate { id:number; name:string; films:number; checked_at:string | null }
export interface CollectionRosterStatus { collections:CollectionRosterCandidate[]; unavailable:string | null }
export interface CollectionRosterBatch {
  results:{id:number;status:'checked'|'skipped'|'failed';message:string;failure?:import('./maintenance-failure').MaintenanceFailure}[];
  requests:number; cacheChanged:boolean; stopped?:string;
}
const positiveId=(id:unknown):id is number=>typeof id==='number' && Number.isSafeInteger(id) && id>0 && id<=2147483647;
const text=(value:unknown)=>typeof value==='string' && value.trim() && value.trim().length<=500 ? value.trim() : null;
const date=(value:unknown)=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value ? value : null;
/** Fail closed on partial/empty rosters; dates/artwork never determine membership. */
export function parseCollectionRoster(value:unknown,expectedId:number,checkedAt:string):CollectionRoster | null {
  if(!value || typeof value!=='object' || !positiveId(expectedId) || !Number.isFinite(Date.parse(checkedAt)))return null;
  const input=value as Record<string,unknown>,name=text(input.name);
  if(input.id!==expectedId || !name || !Array.isArray(input.parts) || !input.parts.length || input.parts.length>10000)return null;
  const parts=new Map<number,CollectionPart>();
  for(const entry of input.parts){
    if(!entry || typeof entry!=='object')return null;
    const part=entry as Record<string,unknown>;
    if(!positiveId(part.id) || part.media_type!==undefined && part.media_type!=='movie')return null;
    if(part.title!=null && typeof part.title!=='string' || part.release_date!=null && typeof part.release_date!=='string')return null;
    const item={id:part.id,title:text(part.title),release_date:date(part.release_date)},old=parts.get(part.id);
    if(old && (old.title!==item.title || old.release_date!==item.release_date))return null;
    parts.set(part.id,item);
  }
  return {id:expectedId,name,checked_at:checkedAt,parts:[...parts.values()].sort((a,b)=>a.id-b.id)};
}
