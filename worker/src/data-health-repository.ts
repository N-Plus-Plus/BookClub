import { classifyFilm, filmLocations, type HealthPage, type IdentityClaim } from '../../shared/data-health';
import { CatalogRepository } from './catalog-repository';
import { CoverageRepository } from './coverage-repository';
import { Repository } from './repository';
import { SchemaCapabilities } from './schema-capabilities';
import type { Env } from './http';
import { CollectionRosterRepository } from './collection-roster-repository';

/** Page-scoped SELECTs only. Builder projection contains counts, never owner context. */
export class DataHealthRepository {
  constructor(private env:Env){}
  async page(after:string|null, query:string):Promise<HealthPage>{
    const db=this.env.DB;
    const ids=(await db.prepare("SELECT id FROM movies WHERE (? IS NULL OR id>?) AND instr(lower(title),lower(?))>0 ORDER BY id LIMIT 81").bind(after,after,query).all<{id:string}>()).results;
    const selected=ids.slice(0,80).map(r=>r.id);
    if(!selected.length)return {films:[],scanned:0,next:null,partial:false};
    const placeholders=selected.map(()=>'?').join(',');
    const capabilities=new SchemaCapabilities(db);
    const predictions=await capabilities.predictionsSupported();
    const catalog=new CatalogRepository(db,capabilities),coverageRepo=new CoverageRepository(db);
    const [movies,coverage,results,members]=await Promise.all([
      catalog.movieDetails(selected,false,true),coverageRepo.read(new Repository(db),this.env,selected,true),
      db.batch([
        db.prepare(`SELECT bm.movie_id,count(DISTINCT bm.builder_id) AS count FROM builder_movies bm JOIN builder_sets b ON b.id=bm.builder_id WHERE bm.movie_id IN (${placeholders}) GROUP BY bm.movie_id`).bind(...selected),
        db.prepare(predictions?`SELECT p.movie_id,m.display_name FROM ai_predictions p JOIN members m ON m.id=p.member_id WHERE p.movie_id IN (${placeholders}) ORDER BY m.sort_order,m.id`:'SELECT NULL AS movie_id,NULL AS display_name WHERE 0').bind(...(predictions?selected:[])),
        db.prepare(`SELECT sm.movie_id,count(*) AS count FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NOT NULL AND sm.movie_id IN (${placeholders}) GROUP BY sm.movie_id`).bind(...selected),
        db.prepare(`SELECT c.movie_id,c.provider,c.identity_provider,c.external_id,c.fetched_at,i.movie_id AS owner_movie_id FROM movie_provider_identity_claims c LEFT JOIN movie_external_ids i ON i.provider=c.identity_provider AND i.external_id=c.external_id WHERE c.movie_id IN (${placeholders}) AND c.identity_provider IN ('imdb','tmdb')`).bind(...selected),
      ]),catalog.members(),
    ]);
    const counts=(index:number)=>new Map((results[index].results as {movie_id:string;count:number}[]).map(r=>[r.movie_id,r.count]));
    const builders=counts(0),archived=counts(2),names=new Map(members.map(m=>[m.id,m.display_name]));
    const associations=results[1].results as {movie_id:string;display_name:string}[];
    const claims=results[3].results as (IdentityClaim&{movie_id:string})[];
    const films=movies.map(movie=>classifyFilm(movie,coverage,filmLocations(movie,{builderCount:builders.get(movie.id)??0,archivedCount:archived.get(movie.id)??0,predictions:associations.filter(r=>r.movie_id===movie.id).map(r=>r.display_name)},names),claims.filter(r=>r.movie_id===movie.id)));
    const rosters=new CollectionRosterRepository(db),rostersSupported=await rosters.supported();
    if(coverage.evidenceSupported&&rostersSupported){
      const collections=(await db.prepare(`SELECT e.movie_id,e.collection_id FROM movie_provider_collections e JOIN movie_external_ids i ON i.movie_id=e.movie_id AND i.provider='tmdb' AND i.external_id=e.external_id WHERE e.movie_id IN (${placeholders}) AND e.collection_id IS NOT NULL`).bind(...selected).all<{movie_id:string;collection_id:number}>()).results;
      const collectionIds=[...new Set(collections.map(c=>c.collection_id))];
      const eligible=collectionIds.length?await rosters.eligible(collectionIds):[];
      for(const film of films){
        const collection=eligible.find(c=>collections.some(link=>link.movie_id===film.id&&link.collection_id===c.id));
        if(!collection||collection.evidence.roster)continue;
        const state=collection.evidence.status;
        film.issues.push({code:'collection-roster',category:'coverage',priority:'actionable',label:`Collection roster ${state==='not_checked'?'not checked':'check '+state}`,state,provider:'tmdb',identity:`collection:${collection.id}`,attemptedAt:collection.evidence.attempted_at??undefined,explanation:`${collection.name}: ${collection.films} distinct active History films qualify for membership evidence. Collection completion cannot be determined without a validated roster.`});
      }
    }
    return {films,scanned:selected.length,next:ids.length>80?selected[79]:null,partial:!predictions||!coverage.fieldsSupported||!coverage.evidenceSupported||!rostersSupported};
  }
}
