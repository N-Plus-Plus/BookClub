import { parseCollectionRoster, type CollectionRoster, type CollectionRosterCandidate, type CollectionRosterEvidence } from '../../shared/collection-roster';
import { ApiError } from './http';

/** One atomic successful replacement; failed attempts never replace checked evidence. */
export class CollectionRosterRepository {
  constructor(private db:D1Database) {}
  async supported(){return Boolean(await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tmdb_collection_rosters'").first());}
  async requireSchema(){if(!await this.supported())throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Install the collection roster migration and update the API Worker.');}
  private evidence(row:{id:number;roster_name:string | null;checked_at:string | null;parts_json:string | null;attempted_at:string | null;attempt_status:string | null}):CollectionRosterEvidence {
    let roster:CollectionRoster | null=null;
    try{if(row.checked_at)roster=parseCollectionRoster({id:row.id,name:row.roster_name,parts:JSON.parse(row.parts_json ?? 'null')},row.id,row.checked_at);}catch{/* Corrupt evidence stays inconclusive. */}
    return {status:roster?'checked':row.attempt_status==='failed'?'failed':row.attempt_status?'inconclusive':'not_checked',roster,attempted_at:row.attempted_at};
  }
  async eligible(ids?:number[]):Promise<(CollectionRosterCandidate & {memberIds:number[];evidence:CollectionRosterEvidence})[]> {
    const result=await this.db.prepare(`SELECT e.collection_id AS id,MIN(e.collection_name) AS name,COUNT(DISTINCT e.movie_id) AS films,
      GROUP_CONCAT(DISTINCT e.external_id) AS member_ids,r.name AS roster_name,r.checked_at,r.parts_json,r.attempted_at,r.attempt_status FROM movie_provider_collections e
      JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider='tmdb' AND i.external_id=e.external_id
      LEFT JOIN tmdb_collection_rosters r ON r.collection_id=e.collection_id
      WHERE e.collection_id IS NOT NULL ${ids?`AND e.collection_id IN (${ids.map(()=>'?').join(',')})`:''} AND EXISTS (SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=e.movie_id AND s.deleted_at IS NULL)
      GROUP BY e.collection_id HAVING COUNT(DISTINCT e.movie_id)>=2 ORDER BY e.collection_id`).bind(...(ids??[])).all<{id:number;name:string;films:number;member_ids:string;roster_name:string | null;checked_at:string | null;parts_json:string | null;attempted_at:string | null;attempt_status:string | null}>();
    return result.results.map(row=>{const evidence=this.evidence(row);return {id:row.id,name:row.name,films:row.films,memberIds:row.member_ids.split(',').map(Number),checked_at:evidence.roster?.checked_at ?? null,evidence};});
  }
  async read():Promise<Record<string,CollectionRosterEvidence>> {
    if(!await this.supported())return {};
    const rows=await this.db.prepare('SELECT * FROM tmdb_collection_rosters').all<{collection_id:number;name:string | null;checked_at:string | null;parts_json:string | null;attempted_at:string;attempt_status:'checked'|'inconclusive'|'failed'}>();
    return Object.fromEntries(rows.results.map(row=>{
      let roster:CollectionRoster | null=null;
      try{if(row.checked_at)roster=parseCollectionRoster({id:row.collection_id,name:row.name,parts:JSON.parse(row.parts_json ?? 'null')},row.collection_id,row.checked_at);}catch{/* Corrupt evidence stays inconclusive. */}
      return [row.collection_id,{status:roster?'checked':row.attempt_status==='failed'?'failed':'inconclusive',roster,attempted_at:row.attempted_at}];
    }));
  }
  async save(roster:CollectionRoster){
    const validated=parseCollectionRoster({id:roster.id,name:roster.name,parts:roster.parts},roster.id,roster.checked_at);
    if(!validated)throw new ApiError(503,'INVALID_PROVIDER_RESPONSE','Collection membership could not be validated.');
    await this.db.prepare(`INSERT INTO tmdb_collection_rosters(collection_id,name,checked_at,parts_json,attempted_at,attempt_status) VALUES(?,?,?,?,?,'checked')
      ON CONFLICT(collection_id) DO UPDATE SET name=excluded.name,checked_at=excluded.checked_at,parts_json=excluded.parts_json,attempted_at=excluded.attempted_at,attempt_status='checked'`)
      .bind(validated.id,validated.name,validated.checked_at,JSON.stringify(validated.parts),validated.checked_at).run();
  }
  async failure(id:number,status:'inconclusive'|'failed'){
    await this.db.prepare(`INSERT INTO tmdb_collection_rosters(collection_id,attempted_at,attempt_status) VALUES(?,?,?)
      ON CONFLICT(collection_id) DO UPDATE SET attempted_at=excluded.attempted_at,attempt_status=excluded.attempt_status`).bind(id,new Date().toISOString(),status).run();
  }
}
