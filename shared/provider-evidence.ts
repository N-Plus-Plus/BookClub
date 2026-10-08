import type { ExternalId } from './types';

const hasControls=(text:string)=>[...text].some(char=>char.charCodeAt(0)<32);

export const providerEvidenceTables = ['movie_provider_collections','movie_provider_awards'] as const;
export const providerEvidenceRelationships = [...providerEvidenceTables,'movie_maintenance_evidence_failures'] as const;
export interface CollectionEvidence { identity: ExternalId; checked_at: string; collection_id: number | null; collection_name: string | null }
export interface AwardsEvidence { identity: ExternalId; checked_at: string; awards_text: string | null; wins: number | null; nominations: number | null }

/** Missing/malformed is inconclusive; only explicit null establishes no collection. */
export function parseCollection(value: unknown, id: string, at: string): CollectionEvidence | undefined {
  if (!/^[1-9]\d{0,9}$/.test(id) || !Number.isFinite(Date.parse(at))) return;
  if (value === null) return {identity:{provider:'tmdb',external_id:id},checked_at:at,collection_id:null,collection_name:null};
  if (!value || typeof value !== 'object') return;
  const {id:collectionId,name} = value as {id?:unknown;name?:unknown};
  if (typeof collectionId !== 'number' || !Number.isSafeInteger(collectionId) || collectionId <= 0 || typeof name !== 'string' || !name.trim() || name.trim()==='N/A' || name.length>1000 || hasControls(name)) return;
  return {identity:{provider:'tmdb',external_id:id},checked_at:at,collection_id:collectionId,collection_name:name.trim()};
}

/** Parse only whole aggregate clauses, never named prizes or an ambiguous "another" subtotal. */
export function parseAwardCounts(text: string): {wins:number | null;nominations:number | null} {
  const result:{wins:number | null;nominations:number | null}={wins:null,nominations:null};
  const clauses=text.split(/[.!]/).map(s=>s.trim()).filter(Boolean);
  const counts:{wins:number | null;nominations:number | null}[]=[];
  for (const clause of clauses) {
    const pair=/^(\d+) wins? (?:&|and) (\d+) nominations?(?: (?:in total|total))?$/i.exec(clause);
    const single=/^(\d+) (wins?|nominations?)(?: (?:in total|total))?$/i.exec(clause);
    if(pair) counts.push({wins:Number(pair[1]),nominations:Number(pair[2])});
    else if(single) counts.push({wins:/^wins?$/i.test(single[2])?Number(single[1]):null,nominations:/^nominations?$/i.test(single[2])?Number(single[1]):null});
  }
  for (const key of ['wins','nominations'] as const) {
    const values=counts.map(c=>c[key]).filter((n):n is number=>n!==null);
    if(values.length===1 && Number.isSafeInteger(values[0])) result[key]=values[0];
  }
  return result;
}
export function parseAwards(value: unknown, id: string, at: string): AwardsEvidence | undefined {
  if (!/^tt\d{7,10}$/.test(id) || !Number.isFinite(Date.parse(at)) || typeof value!=='string' || !value.trim() || value.length>10000 || hasControls(value)) return;
  if(value.trim()==='N/A') return {identity:{provider:'imdb',external_id:id},checked_at:at,awards_text:null,wins:null,nominations:null};
  return {identity:{provider:'imdb',external_id:id},checked_at:at,awards_text:value,...parseAwardCounts(value)};
}
