import type { EnrichmentCapture } from '../../shared/enrichment';
import { ApiError } from './http';

const metadataColumns=['title','runtime','original_language','budget','revenue','popularity','tagline'] as const;
const relations = {
  countries:['code','name'], languages:['code','name','english_name'],companies:['external_id','name','origin_country'],
  credits:['kind','role','person_id','name','original_name','department','job','character','billing_order','credit_id','ordinal'],
  content_ratings:['country','certification','release_type','release_date'],keywords:['external_id','name'],
  watch_offers:['collection','service_id','name','country','access_type','link','ordinal'],
  identity_claims:['identity_provider','external_id'],
} as const;
export class EnrichmentRepository {
  constructor(private db: D1Database) {}
  async save(movieId: string, capture: EnrichmentCapture) {
    const {provider,identity,fetchedAt}=capture;
    const before=await this.db.prepare('SELECT * FROM movie_provider_metadata WHERE movie_id=? AND provider=?').bind(movieId,provider).first<Record<string,unknown>>();
    const metadata=Object.fromEntries(metadataColumns.map(c=>[c,capture.metadata[c] === undefined ? before?.[c] ?? null : capture.metadata[c]]));
    const values: Record<string,Record<string,unknown>[] | undefined> = {...capture,identity_claims:capture.identities?.map(i=>({identity_provider:i.provider,external_id:i.external_id}))} as unknown as Record<string,Record<string,unknown>[] | undefined>;
    const sets=Object.entries(relations).map(([name,columns])=>({name,columns,rows:values[name] === undefined ? undefined : [...new Map(values[name]!.map(row=>{
      const fields=columns.map(c=>row[c] ?? null);
      // Ordinal is evidence, but identical watch offers are one availability record.
      const identity=name==='countries' || name==='languages' || name==='companies' ? fields.slice(0,1)
        : name==='keywords' ? [row.external_id ?? row.name]
        : name==='credits' && row.credit_id ? [row.kind,row.credit_id]
        : name==='watch_offers' ? fields.slice(0,-1) : fields;
      const key=JSON.stringify(identity);
      return [key,{key,fields}];
    })).values()].sort((a,b)=>a.key.localeCompare(b.key))}));
    const content=JSON.stringify([metadata,sets.map(s=>[s.name,s.rows])]);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const previous=await this.db.prepare('SELECT content_hash FROM movie_provider_enrichment_state WHERE movie_id=? AND provider=?').bind(movieId,provider).first<{content_hash:string}>();
    const changed=previous?.content_hash !== hash;
    const statements: D1PreparedStatement[] = [];
    // NULL fails the whole atomic batch when the requested identity raced or disappeared.
    statements.push(this.db.prepare(`INSERT INTO movie_provider_enrichment_state(movie_id,provider,identity_provider,external_id,content_hash,checked_at,fetched_at)
      VALUES(?,?,?,CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END,?,?,?)
      ON CONFLICT(movie_id,provider) DO UPDATE SET identity_provider=excluded.identity_provider,external_id=excluded.external_id,content_hash=excluded.content_hash,checked_at=excluded.checked_at,fetched_at=excluded.fetched_at`)
      .bind(movieId,provider,identity.provider,movieId,identity.provider,identity.external_id,identity.external_id,hash,fetchedAt,fetchedAt));
    statements.push(this.db.prepare(`INSERT INTO movie_provider_metadata(movie_id,provider,${metadataColumns.join(',')},fetched_at) VALUES(${Array(10).fill('?').join(',')})
      ON CONFLICT(movie_id,provider) DO UPDATE SET ${metadataColumns.map(c=>`${c}=excluded.${c}`).join(',')},fetched_at=excluded.fetched_at`)
      .bind(movieId,provider,...metadataColumns.map(c=>metadata[c]),fetchedAt));
    if (changed) for (const set of sets) if (set.rows !== undefined) {
      statements.push(this.db.prepare(`DELETE FROM movie_provider_${set.name} WHERE movie_id=? AND provider=?`).bind(movieId,provider));
      const width=set.columns.length+4, size=Math.floor(100/width);
      for (let offset=0;offset<set.rows.length;offset+=size) {
        const rows=set.rows.slice(offset,offset+size);
        statements.push(this.db.prepare(`INSERT INTO movie_provider_${set.name}(movie_id,provider,item_key,${set.columns.join(',')},fetched_at) VALUES ${rows.map(()=>`(${Array(width).fill('?').join(',')})`).join(',')}`)
          .bind(...rows.flatMap(row=>[movieId,provider,row.key,...row.fields,fetchedAt])));
      }
    }
    const knownBefore=await this.db.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=?').bind(movieId).all<{provider:string;external_id:string}>();
    for (const claim of capture.identities ?? []) statements.push(this.db.prepare('INSERT OR IGNORE INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?)').bind(movieId,claim.provider,claim.external_id));
    try { await this.db.batch(statements); }
    catch (error) {
      if (String(error).includes('movie_provider_enrichment_state.external_id')) throw new ApiError(409,'IDENTITY_CONFLICT','Stored provider identity changed. Refresh before retrying.');
      throw error;
    }
    const knownAfter=await this.db.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=?').bind(movieId).all<{provider:string;external_id:string}>();
    const conflicts=(capture.identities ?? []).filter(c=>!knownAfter.results.some(i=>i.provider===c.provider && i.external_id===c.external_id)).length;
    return {changed,canonicalChanged:knownAfter.results.length>knownBefore.results.length,conflicts};
  }
}
