import type { Asset, ExternalId } from '../../shared/types';
import type { MetadataMovie } from '../../shared/metadata';
import { requiredScores } from '../../shared/ranking';
import { groupMovies } from './catalog-assembly';
import { usableScoreSql, liveScoreSql } from './score-sql';
import { metadataSql, metadataPrioritySql, validTmdbSql, validImdbSql } from './metadata-sql';
import { metadataMovieColumns } from './movie-projections';
import { CatalogRepository } from './catalog-repository';
import { ApiError } from './http';
import { SchemaCapabilities } from './schema-capabilities';

type WithMovie<T> = T & { movie_id: string };

export class MaintenanceRepository {
  constructor(private db: D1Database, private capabilities = new SchemaCapabilities(db), private catalog = new CatalogRepository(db,capabilities)) {}

  /** Maintenance adds scope validation to the shared selected-film loader. */
  async maintenanceDetails(ids: string[], validateScope = false) {
    return this.catalog.movieDetails(ids,validateScope);
  }

  async scoreChecks(ids: string[]) {
    if (!ids.length) return [];
    return (await this.db.prepare(`SELECT movie_id,score_key,available FROM movie_score_checks WHERE movie_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{movie_id:string;score_key:string;available:number}>()).results;
  }

  async saveScoreChecks(id: string, checks: {key:string;available:boolean}[]) {
    if (!checks.length) return;
    const at = new Date().toISOString();
    // Stored live scores are positive evidence; retain legacy positive rows untouched.
    await this.db.batch(checks.map(check => check.available
      ? this.db.prepare('DELETE FROM movie_score_checks WHERE movie_id=? AND score_key=? AND available=0').bind(id,check.key)
      : this.db.prepare(`INSERT INTO movie_score_checks(movie_id,score_key,available,checked_at) VALUES(?,?,0,?) ON CONFLICT(movie_id,score_key) DO UPDATE SET available=0,checked_at=excluded.checked_at`).bind(id,check.key,at)));
  }

  async scoreMaintenanceStatus(): Promise<import('../../shared/types').ScoreMaintenanceStatus> {
    const rows = (await this.db.prepare(`WITH scope AS (
      SELECT id FROM movies WHERE EXISTS(SELECT 1 FROM classics WHERE movie_id=movies.id)
      OR EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=movies.id AND s.deleted_at IS NULL)
    ), keys(score_key) AS (VALUES ${requiredScores.map(key => "('"+key+"')").join(',')})
    SELECT scope.id,keys.score_key,coalesce(c.available,1) AS available FROM scope CROSS JOIN keys
    LEFT JOIN movie_score_checks c ON c.movie_id=scope.id AND c.score_key=keys.score_key
    WHERE NOT EXISTS(SELECT 1 FROM source_scores ss WHERE ss.movie_id=scope.id AND ss.provider||':'||ss.metric=keys.score_key
      AND (${usableScoreSql()}) AND (${liveScoreSql()}))
    ORDER BY scope.id,keys.score_key`).all<{id:string;score_key:string;available:number}>()).results;
    return {candidateIds:[...new Set(rows.filter(r => r.available !== 0).map(r => r.id))],eligibleDimensions:rows.filter(r => r.available !== 0).length,
      unavailableDimensions:rows.filter(r => r.available === 0).length,unavailableFilms:new Set(rows.filter(r => r.available === 0).map(r => r.id)).size};
  }

  /** Metadata-only indexed reads; no scores, roster, History or global eligibility query. */
  async selectedMetadataMovies(ids: string[]): Promise<MetadataMovie[]> {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(','), director = await this.capabilities.hasDirector();
    const result = await this.db.batch([
      this.db.prepare(`SELECT ${metadataMovieColumns(director)} FROM movies WHERE id IN (${marks})`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,external_id FROM movie_external_ids WHERE movie_id IN (${marks})`).bind(...ids),
      this.db.prepare(`SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets WHERE movie_id IN (${marks}) AND provider='tmdb' AND asset_type IN ('poster','backdrop')`).bind(...ids),
      this.db.prepare(`SELECT movie_id,genre FROM movie_genres WHERE movie_id IN (${marks}) ORDER BY genre`).bind(...ids),
    ]);
    const identities = groupMovies(result[1].results as WithMovie<ExternalId>[]);
    const assets = groupMovies(result[2].results as WithMovie<Asset>[]);
    const genres = groupMovies(result[3].results as {movie_id:string;genre:string}[]);
    const movies = new Map((result[0].results as Omit<MetadataMovie,'assets'|'external_ids'|'genres'>[]).map(movie => [movie.id,{
      ...movie,external_ids:identities.get(movie.id) ?? [],
      assets:assets.get(movie.id) ?? [],genres:(genres.get(movie.id) ?? []).map(g => g.genre),
    }]));
    return ids.map(id => {
      const movie = movies.get(id);
      if (!movie) throw new ApiError(422,'INVALID_MOVIES','A selected film no longer exists. Refresh before retrying.');
      return movie;
    });
  }

  /** Global selection retained only for the legacy metadata endpoint. */
  async metadataCandidates(limit: number): Promise<MetadataMovie[]> {
    const sql = metadataSql(await this.capabilities.hasDirector(),true);
    const rows = (await this.db.prepare(`${sql}
      SELECT ${metadataMovieColumns('metadata_director')},tmdb_id,poster,backdrop
      FROM eligible WHERE identified=1 AND candidate ORDER BY ${metadataPrioritySql} DESC,lower(id),id DESC LIMIT ?`)
      .bind(new Date().toISOString(),limit).all<Omit<MetadataMovie,'assets'|'external_ids'|'genres'> & {tmdb_id:string;poster:number;backdrop:number}>()).results;
    if (!rows.length) return [];
    const genres = groupMovies((await this.db.prepare(`SELECT movie_id,genre FROM movie_genres WHERE movie_id IN (${rows.map(() => '?').join(',')}) ORDER BY genre`).bind(...rows.map(r => r.id)).all<{movie_id:string;genre:string}>()).results);
    return rows.map(({tmdb_id,poster,backdrop,...movie}) => ({...movie,external_ids:[{provider:'tmdb',external_id:tmdb_id}],
      genres:(genres.get(movie.id) ?? []).map(g => g.genre),
      assets:(['poster','backdrop'] as const).filter(type => type === 'poster' ? poster : backdrop)
        .map(asset_type => ({provider:'tmdb',asset_type,reference:'',width:null,height:null,preferred:0}))}));
  }

  /** Global counts retained only for the legacy metadata endpoint. */
  async metadataCounts(): Promise<{remaining: number; unidentified: number}> {
    return (await this.db.prepare(`${metadataSql(await this.capabilities.hasDirector(),false)}
      SELECT coalesce(sum(identified=1 AND candidate),0) AS remaining,coalesce(sum(identified=0),0) AS unidentified FROM eligible`)
      .bind(new Date().toISOString()).first<{remaining:number;unidentified:number}>())!;
  }

  /** Compatibility selection uses only identity, usable score existence and roster completeness. */
  async enrichmentCandidates(limit:number) {
    const sql = `WITH active AS (SELECT id FROM members WHERE active=1), recognised(score_key) AS (VALUES ${requiredScores.map(k => "('"+k+"')").join(',')}),
      scored AS (SELECT DISTINCT movie_id FROM source_scores ss JOIN recognised r ON r.score_key=ss.provider||':'||ss.metric WHERE ${usableScoreSql()}),
      answered AS (SELECT movie_id,count(*) AS count FROM seen_states JOIN active ON active.id=member_id WHERE seen IN (0,1) GROUP BY movie_id),
      identified AS (SELECT DISTINCT movie_id FROM movie_external_ids WHERE (provider='tmdb' AND ${validTmdbSql('external_id',false)}) OR (provider='imdb' AND ${validImdbSql('external_id')})),
      candidates AS (SELECT m.id,m.title,i.movie_id IS NOT NULL AS identified FROM movies m JOIN classics c ON c.movie_id=m.id
        LEFT JOIN scored s ON s.movie_id=m.id LEFT JOIN answered a ON a.movie_id=m.id LEFT JOIN identified i ON i.movie_id=m.id
        WHERE s.movie_id IS NULL OR coalesce(a.count,0)<>(SELECT count(*) FROM active) OR (SELECT count(*) FROM active)=0)`;
    const results = await this.db.batch([
      this.db.prepare(`${sql} SELECT id FROM candidates WHERE identified ORDER BY title,id LIMIT ?`).bind(limit),
      this.db.prepare(`${sql} SELECT coalesce(sum(identified),0) AS eligible,coalesce(sum(NOT identified),0) AS unidentified FROM candidates`),
    ]);
    const ids = (results[0].results as {id:string}[]).map(r => r.id), counts = results[1].results[0] as {eligible:number;unidentified:number};
    return {ids,remaining:Math.max(0,counts.eligible-ids.length),unidentified:counts.unidentified};
  }

  async providerCooldown(provider: string, readOnly = false): Promise<number | null> {
    const row = await this.db.prepare('SELECT retry_after_until FROM provider_cooldowns WHERE provider=?').bind(provider).first<{retry_after_until:string}>();
    if (!row) return null; const seconds = Math.ceil((Date.parse(row.retry_after_until)-Date.now())/1000);
    if (seconds > 0) return seconds;
    if (!readOnly) await this.db.prepare('DELETE FROM provider_cooldowns WHERE provider=?').bind(provider).run(); return null;
  }

  async setProviderCooldown(provider: string, seconds: number) {
    const now = new Date(), until = new Date(now.getTime()+Math.max(0,seconds)*1000).toISOString();
    await this.db.prepare('INSERT INTO provider_cooldowns(provider,retry_after_until,updated_at) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET retry_after_until=excluded.retry_after_until,updated_at=excluded.updated_at').bind(provider,until,now.toISOString()).run();
  }
}
