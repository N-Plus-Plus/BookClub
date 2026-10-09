import { collectedFieldStates,maintenanceContract,type CoverageOperation,type FieldState,type FieldCheck,type OperationFieldCoverage } from '../../shared/maintenance-contract';
import type { ExternalId } from '../../shared/types';
import type { MaintenanceCoverage } from '../../shared/maintenance-plan';
/** Statements join the owning persistence batch; success cannot outlive a failed save. */
export class FieldCoverageRepository {
  constructor(private db:D1Database){}
  async supported(){return Boolean(await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='movie_maintenance_fields'").first());}
  async read(ids:string[],coverage:MaintenanceCoverage,supported?:boolean):Promise<OperationFieldCoverage[]>{
    const where=ids.length?`movie_id IN (${ids.map(()=>'?').join(',')})`:'0';
    const query=await this.db.prepare(`SELECT p.*,i.provider AS identity_provider,i.external_id FROM movie_provider_metadata p JOIN movie_external_ids i ON i.movie_id=p.movie_id AND ((p.provider='tmdb' AND i.provider='tmdb') OR (p.provider='omdb' AND i.provider='imdb') OR (p.provider='mdblist' AND i.provider IN ('imdb','tmdb'))) WHERE ${ids.length?'p.'+where:'0'}`).bind(...ids).all<Record<string,unknown>>();
    const result:OperationFieldCoverage[]=[];
    const saved=(supported??await this.supported())?(await this.db.prepare(`SELECT * FROM movie_maintenance_fields WHERE ${where}`).bind(...ids).all<{movie_id:string;provider:string;operation:CoverageOperation;identity_provider:string;external_id:string;checks_json:string}>()).results:[];
    const scope=ids.length?`id IN (${ids.map(()=>'?').join(',')})`:'0';
    const families=['countries','languages','companies','credits','content_ratings','keywords','watch_offers','identity_claims'];
    // D1 allows only five terms in a compound SELECT. Indexed EXISTS probes keep
    // all eight families in one statement without an eight-way UNION.
    const relationshipRows=await this.db.prepare(`WITH scope AS (SELECT id AS movie_id FROM movies WHERE ${scope})
      SELECT scope.movie_id,p.value AS provider,f.value AS family FROM scope
      CROSS JOIN json_each('["tmdb","mdblist","omdb"]') p CROSS JOIN json_each('${JSON.stringify(families)}') f
      WHERE CASE f.value ${families.map(f=>`WHEN '${f}' THEN EXISTS(SELECT 1 FROM movie_provider_${f} r WHERE r.movie_id=scope.movie_id AND r.provider=p.value)`).join(' ')} END`).bind(...ids).all<{movie_id:string;provider:string;family:string}>();
    const presentFamilies=new Set(relationshipRows.results.map(r=>`${r.movie_id}:${r.provider}:${r.family}`));
    const add=(movie_id:string,provider:string,operation:CoverageOperation,identity:ExternalId,states:Record<string,FieldState>,at:string)=>{
      const fields=Object.fromEntries(Object.entries(states).map(([key,state])=>[key,{state,checked_at:at}]));
      const old=result.find(c=>c.movie_id===movie_id&&c.provider===provider&&c.operation===operation&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
      if(old)Object.assign(old.fields,fields);else result.push({movie_id,provider,operation,identity_provider:identity.provider,external_id:identity.external_id,fields});
    };
    // Old complete enrichment state proves validated relationship families, including empty sets.
    for(const state of coverage.enrichment){
      const operation=state.provider==='tmdb'?'tmdb-enrichment':'mdblist-enrichment';
      const fields:Record<string,FieldState>={};
      for(const f of maintenanceContract[operation].fields.filter(f=>f.kind==='family')){
        const table=f.id==='identities'?'identity_claims':f.id;
        fields[f.id]=presentFamilies.has(`${state.movie_id}:${state.provider}:${table}`)?'present':'checked_unavailable';
      }
      const metadata=query.results.find(r=>r.movie_id===state.movie_id&&r.provider===state.provider&&r.identity_provider===state.identity_provider&&r.external_id===state.external_id);
      if(metadata)Object.assign(fields,Object.fromEntries(Object.entries(collectedFieldStates(operation,metadata)).filter(([key])=>metadata[key]!=null)));
      add(state.movie_id,state.provider,operation,{provider:state.identity_provider,external_id:state.external_id},fields,state.checked_at);
    }
    // Owned positive scalar values remain useful even when a legacy full-response marker is absent.
    for(const row of query.results){
      const provider=String(row.provider),identity={provider:String(row.identity_provider),external_id:String(row.external_id)};
      if(coverage.enrichment.some(c=>c.movie_id===row.movie_id&&c.provider===provider&&(c.identity_provider!==identity.provider||c.external_id!==identity.external_id)) || saved.some(c=>c.movie_id===row.movie_id&&c.provider===provider&&(c.identity_provider!==identity.provider||c.external_id!==identity.external_id)))continue;
      const operations:CoverageOperation[]=provider==='tmdb'?['tmdb-enrichment','tmdb-metadata']:provider==='omdb'?['omdb-metadata']:['mdblist-enrichment'];
      for(const operation of operations){
        const states=Object.fromEntries(Object.entries(collectedFieldStates(operation,row)).filter(([key])=>row[key]!=null));
        const old=result.find(c=>c.movie_id===row.movie_id&&c.operation===operation&&c.identity_provider===identity.provider&&c.external_id===identity.external_id);
        if(old)for(const [key,state] of Object.entries(states))old.fields[key] ??= {state,checked_at:String(row.fetched_at)};
        else if(Object.keys(states).length)add(String(row.movie_id),provider,operation,identity,states,String(row.fetched_at));
      }
    }
    for(const check of coverage.checks.filter(c=>c.domain==='metadata'&&c.provider==='omdb')){
      const fields:Record<string,FieldState>=Object.fromEntries(maintenanceContract['omdb-metadata'].fields.filter(f=>check.absent.includes(f.id)).map(f=>[f.id,'checked_unavailable']));
      const title=query.results.find(r=>r.movie_id===check.movie_id&&r.provider==='omdb'&&r.external_id===check.external_id);
      if(title?.title)fields.title='present';
      // Existing metadata checks attest non-absent canonical fields, while title absence is explicit only.
      for(const f of maintenanceContract['omdb-metadata'].fields.filter(f=>f.id!=='title'&&!check.absent.includes(f.id)))Object.assign(fields,{[f.id]:'present'});
      add(check.movie_id,'omdb','omdb-metadata',{provider:check.identity_provider,external_id:check.external_id},fields,check.checked_at);
    }
    const movies=await this.db.prepare(`SELECT m.*,CASE WHEN EXISTS(SELECT 1 FROM movie_genres g WHERE g.movie_id=m.id) THEN 1 ELSE 0 END AS known_genres,
      (SELECT reference FROM movie_assets a WHERE a.movie_id=m.id AND a.provider='tmdb' AND a.asset_type='poster' LIMIT 1) AS poster,
      (SELECT reference FROM movie_assets a WHERE a.movie_id=m.id AND a.provider='tmdb' AND a.asset_type='backdrop' LIMIT 1) AS backdrop,
      i.external_id FROM movies m JOIN movie_external_ids i ON i.movie_id=m.id AND i.provider='tmdb' WHERE ${ids.length?'m.'+scope:'0'}`).bind(...ids).all<Record<string,unknown>>();
    for(const movie of movies.results)if(movie.tmdb_metadata_checked_at && !coverage.enrichment.some(c=>c.movie_id===movie.id&&c.provider==='tmdb'&&c.external_id!==movie.external_id) && !saved.some(r=>r.movie_id===movie.id&&r.provider==='tmdb'&&r.external_id!==movie.external_id)){
      const title=query.results.find(r=>r.movie_id===movie.id&&r.provider==='tmdb')?.title;
      const values={...movie,title,release:movie.release_date,genres:movie.known_genres?[1]:undefined};
      add(String(movie.id),'tmdb','tmdb-metadata',{provider:'tmdb',external_id:String(movie.external_id)},Object.fromEntries(Object.entries(collectedFieldStates('tmdb-metadata',values)).filter(([,state])=>state==='present')),String(movie.tmdb_metadata_checked_at));
    }
    // Counts and wording have independent availability, even in a conclusively checked awards response.
    if(coverage.evidenceSupported)for(const operation of ['tmdb-collections','omdb-awards'] as const){
      const provider=operation==='tmdb-collections'?'tmdb':'omdb',table=operation==='tmdb-collections'?'collections':'awards';
      const evidence=await this.db.prepare(`SELECT * FROM movie_provider_${table} WHERE ${where}`).bind(...ids).all<Record<string,unknown>>();
      for(const row of evidence.results)add(String(row.movie_id),provider,operation,{provider:String(row.identity_provider),external_id:String(row.external_id)},collectedFieldStates(operation,row),String(row.checked_at));
    }
    {
      for(const {checks_json,...row} of saved){
        if(!Object.hasOwn(maintenanceContract,row.operation))continue;
        const parsed=JSON.parse(checks_json) as Record<string,unknown>;
        const fields=Object.fromEntries(Object.entries(parsed).filter(([key,value])=>maintenanceContract[row.operation].fields.some(f=>f.id===key)&&value&&typeof value==='object'&&'state' in value&&['present','checked_unavailable'].includes(String(value.state))&&'checked_at' in value&&typeof value.checked_at==='string'&&Number.isFinite(Date.parse(value.checked_at)))) as Record<string,FieldCheck>;
        const old=result.find(c=>c.movie_id===row.movie_id&&c.provider===row.provider&&c.operation===row.operation&&c.identity_provider===row.identity_provider&&c.external_id===row.external_id);
        if(old){
          const movie=movies.results.find(m=>m.id===row.movie_id);
          if(row.operation==='tmdb-metadata' && Object.values(fields).some(f=>f.checked_at===movie?.tmdb_metadata_checked_at))old.fields=fields;else Object.assign(old.fields,fields);
        }else result.push({...row,fields});
      }
    }
    return result;
  }
  async statements(movieId:string,provider:string,operation:CoverageOperation,identity:ExternalId,values:Record<string,unknown>,at:string,states?:Record<string,FieldState>):Promise<D1PreparedStatement[]>{
    if(!await this.supported())return [];
    const checked=states ?? collectedFieldStates(operation,values);
    const fields=Object.fromEntries(Object.entries(checked).filter(([key])=>maintenanceContract[operation].fields.some(f=>f.id===key)).map(([key,state])=>[key,{state,checked_at:at}]));
    if(!Object.keys(fields).length)return [];
    return [this.db.prepare(`INSERT INTO movie_maintenance_fields(movie_id,provider,operation,identity_provider,external_id,checks_json)
      VALUES(?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END,?)
      ON CONFLICT(movie_id,provider,operation) DO UPDATE SET identity_provider=excluded.identity_provider,external_id=excluded.external_id,
      checks_json=CASE WHEN movie_maintenance_fields.identity_provider=excluded.identity_provider AND movie_maintenance_fields.external_id=excluded.external_id THEN json_patch(movie_maintenance_fields.checks_json,excluded.checks_json) ELSE excluded.checks_json END`)
      .bind(movieId,provider,operation,identity.provider,movieId,identity.provider,identity.external_id,identity.external_id,JSON.stringify(fields))];
  }
}
