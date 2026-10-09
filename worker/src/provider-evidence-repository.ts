import { parseAwards, parseCollection, providerEvidenceRelationships, type AwardsEvidence, type CollectionEvidence } from '../../shared/provider-evidence';
import { ApiError } from './http';
import { FieldCoverageRepository } from './field-coverage-repository';

/** Independent successful checks from details responses; no provider calls or canonical writes. */
export class ProviderEvidenceRepository {
  constructor(private db:D1Database) {}
  async supported() {
    const rows=await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN (?,?,?)").bind(...providerEvidenceRelationships).all();
    return rows.results.length===3;
  }
  async save(movieId:string,kind:'collections'|'awards',evidence:CollectionEvidence | AwardsEvidence | undefined) {
    if(!evidence || !await this.supported()) return false;
    const parsed=kind==='collections' ? parseCollection('collection_id' in evidence && evidence.collection_id===null ? null : {id:(evidence as CollectionEvidence).collection_id,name:(evidence as CollectionEvidence).collection_name},evidence.identity.external_id,evidence.checked_at)
      : parseAwards((evidence as AwardsEvidence).awards_text===null?'N/A':(evidence as AwardsEvidence).awards_text,evidence.identity.external_id,evidence.checked_at);
    if(!parsed || evidence.identity.provider!==parsed.identity.provider || Object.entries(parsed).some(([key,value])=>key!=='identity' && value!==(evidence as unknown as Record<string,unknown>)[key])) throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','Malformed provider evidence. Previous evidence is preserved.');
    const fields=kind==='collections'?['collection_id','collection_name']:['awards_text','wins','nominations'];
    const values=fields.map(f=>(parsed as unknown as Record<string,string | number | null>)[f]);
    const table=`movie_provider_${kind}`;
    const current=await this.db.prepare(`SELECT ${fields.join(',')} FROM ${table} WHERE movie_id=? AND identity_provider=? AND external_id=?`).bind(movieId,parsed.identity.provider,parsed.identity.external_id).first<Record<string,unknown>>();
    const statement=this.db.prepare(`INSERT INTO ${table}(movie_id,identity_provider,external_id,checked_at,${fields.join(',')}) VALUES(CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END,?,?,?,${fields.map(()=>'?').join(',')}) ON CONFLICT(movie_id) DO UPDATE SET identity_provider=excluded.identity_provider,external_id=excluded.external_id,checked_at=excluded.checked_at,${fields.map(f=>`${f}=excluded.${f}`).join(',')}`).bind(movieId,parsed.identity.provider,parsed.identity.external_id,movieId,parsed.identity.provider,parsed.identity.external_id,parsed.checked_at,...values);
    await this.db.batch([statement,...await new FieldCoverageRepository(this.db).statements(movieId,kind==='collections'?'tmdb':'omdb',kind==='collections'?'tmdb-collections':'omdb-awards',parsed.identity,Object.fromEntries(fields.map((f,i)=>[f,values[i]])),parsed.checked_at)]);
    return !current || fields.some((f,i)=>current[f]!==values[i]);
  }
}
