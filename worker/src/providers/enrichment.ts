import type { EnrichmentCapture } from '../../../shared/enrichment';
import { usableTitle } from '../../../shared/titles';
import type { ExternalId } from '../../../shared/types';

type ObjectValue = Record<string,unknown>;
const object = (v: unknown): ObjectValue | undefined => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as ObjectValue : undefined;
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const id = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? String(v) : typeof v === 'string' && /^[1-9]\d*$/.test(v) ? v : null;
// Exact jobs, rather than broad department guesses. Screenplay is a separate analytical role.
export const crewRoles: Record<string,string> = {Writer:'writer',Screenplay:'screenplay',Producer:'producer','Director of Photography':'cinematographer',Cinematography:'cinematographer','Original Music Composer':'composer',Editor:'editor'};
function rows<T>(value: unknown, parse: (v: ObjectValue,index: number) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: T[] = [];
  for (let i=0;i<value.length;i++) { const entry=object(value[i]); if (!entry) return undefined; const parsed=parse(entry,i); if (parsed === undefined) return undefined; result.push(parsed); }
  return result;
}
function scalars(m: ObjectValue, fields: string[], numeric: string[]) {
  const values: Record<string,string | number | null> = {};
  for (const field of fields) if (m[field] === null || typeof m[field] === 'string') values[field]=text(m[field]);
  for (const field of numeric) if (m[field] === null || number(m[field]) !== null) values[field]=number(m[field]);
  return values;
}
export function parseTmdbEnrichment(data: unknown, at: string): EnrichmentCapture | undefined {
  const m=object(data); if (!m || !id(m.id) || !text(m.title)) return undefined;
  const countries=rows(m.production_countries,c=>text(c.iso_3166_1) ? {code:String(c.iso_3166_1),name:text(c.name)} : undefined);
  const languages=rows(m.spoken_languages,l=>text(l.iso_639_1) ? {code:String(l.iso_639_1),name:text(l.name),english_name:text(l.english_name)} : undefined);
  const companies=rows(m.production_companies,c=>id(c.id) && text(c.name) ? {external_id:id(c.id)!,name:text(c.name)!,origin_country:text(c.origin_country)} : undefined);
  const keywords=rows(object(m.keywords)?.keywords,k=>id(k.id) && text(k.name) ? {external_id:id(k.id),name:text(k.name)!} : undefined);
  const credits=object(m.credits), releases=object(m.release_dates);
  if (!countries || !languages || !companies || !keywords || !Array.isArray(credits?.cast) || !Array.isArray(credits?.crew) || !Array.isArray(releases?.results)) return undefined;
  const cast=rows(credits.cast,(p,ordinal)=>id(p.id) && text(p.name) && Number.isSafeInteger(p.order) && Number(p.order)>=0 ? {
    kind:'cast',role:'cast',person_id:id(p.id)!,name:text(p.name)!,original_name:text(p.original_name),department:text(p.known_for_department),job:null,character:text(p.character),billing_order:Number(p.order),credit_id:text(p.credit_id),ordinal,
  } : undefined);
  if (!cast) return undefined;
  const crew: NonNullable<EnrichmentCapture['credits']> = [];
  for (const [ordinal,value] of credits.crew.entries()) {
    const p=object(value); if (!p) return undefined;
    const job=text(p.job), role=job ? crewRoles[job] : undefined; if (!role) continue;
    if (!id(p.id) || !text(p.name)) return undefined;
    crew.push({kind:'crew',role,person_id:id(p.id)!,name:text(p.name)!,original_name:text(p.original_name),department:text(p.department),job,character:null,billing_order:null,credit_id:text(p.credit_id),ordinal});
  }
  const ratings: NonNullable<EnrichmentCapture['content_ratings']> = [];
  for (const value of releases.results) {
    const r=object(value); if (!r || !text(r.iso_3166_1)) return undefined;
    if (!['US','AU'].includes(String(r.iso_3166_1))) continue;
    if (!Array.isArray(r.release_dates)) return undefined;
    for (const item of r.release_dates) {
      const entry=object(item); if (!entry || typeof entry.certification !== 'string') return undefined;
      const certification=text(entry.certification); if (!certification) continue;
      ratings.push({country:String(r.iso_3166_1),certification,release_type:number(entry.type),release_date:text(entry.release_date)});
    }
  }
  return {provider:'tmdb',identity:{provider:'tmdb',external_id:id(m.id)!},fetchedAt:at,
    metadata:scalars(m,['title','original_language','tagline'],['budget','revenue','popularity']),countries,languages,companies,
    credits:[...cast.sort((a,b)=>a.billing_order!-b.billing_order! || a.ordinal-b.ordinal).slice(0,15).map((c,ordinal)=>({...c,ordinal})),...crew],keywords,content_ratings:ratings};
}
export function parseMdbTitle(data: unknown, identity: ExternalId): string | null {
  const m=object(data),ids=object(m?.ids);
  if (!m || (m.type!==undefined && m.type!=='movie') || String(ids?.[identity.provider] ?? (identity.provider==='imdb' ? m.imdb_id : undefined))!==identity.external_id) return null;
  return usableTitle(m.title);
}
export function parseMdbEnrichment(data: unknown, identity: ExternalId, at: string): EnrichmentCapture | undefined {
  const m=object(data), ids=object(m?.ids); if (!m || !ids || !text(m.title) || (m.type!==undefined && m.type!=='movie') || String(ids[identity.provider] ?? m.imdb_id) !== identity.external_id) return undefined;
  const identities: ExternalId[]=[];
  for (const [provider,value] of Object.entries(ids)) {
    const valid=provider==='imdb' ? typeof value==='string' && /^tt\d{7,10}$/.test(value) : provider==='mdblist' ? Boolean(id(value)) || typeof value==='string' && /^[a-zA-Z0-9_-]+$/.test(value) : Boolean(id(value));
    if (valid && /^[a-z][a-z0-9_-]*$/.test(provider)) identities.push({provider,external_id:String(value)});
  }
  const keywords=rows(m.keywords,k=>text(k.name) ? {external_id:id(k.id),name:text(k.name)!} : undefined);
  const offers: NonNullable<EnrichmentCapture['watch_offers']> = [];
  for (const collection of ['streams','watch_providers']) {
    const parsed=rows(m[collection],(s,ordinal)=>id(s.id) && text(s.name) ? {collection,service_id:id(s.id)!,name:text(s.name)!,country:null,access_type:null,link:null,ordinal} : undefined);
    if (!parsed) return undefined;
    // Provider duplicates do not imply unknown access types; retain first display order.
    const seen=new Set<string>(); for (const offer of parsed) { const key=`${offer.service_id}:${offer.name}`; if (!seen.has(key)) { seen.add(key); offers.push(offer); } }
  }
  if (!keywords) return undefined;
  return {provider:'mdblist',identity,fetchedAt:at,metadata:scalars(m,['title'],['runtime']),identities,keywords,watch_offers:offers};
}
