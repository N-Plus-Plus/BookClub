import type { Asset, Catalog, CompactCatalog, Cycle, ExternalId, Member, Movie, Score, SeenAnswer, Session, SessionInput, ManualMovieInput, SavedSearchResult } from '../../shared/types';
import { normalizeTitle } from '../../shared/search';
import { type MetadataMovie } from '../../shared/metadata';
import { requiredScores } from '../../shared/ranking';
import type { ProviderMovie } from './providers/types';
import { ApiError } from './http';
import { ProductRepository } from './product-repository';

import { assembleMovies, groupMovies } from './catalog-assembly';
import { effectiveScoreSql, usableScoreSql, liveScoreSql } from './score-sql';
import { metadataSql, metadataPrioritySql, validTmdbSql, validImdbSql } from './metadata-sql';

type SessionRow = Omit<Session,'movies'>;
type WithMovie<T> = T & { movie_id: string };

export class Repository {
  constructor(private db: D1Database) {}
  // Repository instances are request-scoped; never retain an old schema across requests.
  private directorCapability?: Promise<boolean>;
  private hasDirector() {
    return this.directorCapability ??= this.db.prepare('PRAGMA table_info(movies)').all<{name:string}>()
      .then(result => result.results.some(column => column.name === 'director'));
  }
  async searchMovies(query: string, tmdbIds: string[] = []): Promise<SavedSearchResult[]> {
    // Normalise whitespace in SQL before matching; return only identification fields.
    const rows = (await this.db.prepare(`WITH RECURSIVE titles(id,title,year,normal) AS (
      SELECT id,title,year,lower(trim(replace(replace(replace(title,char(9),' '),char(10),' '),char(13),' '))) FROM movies
      UNION ALL SELECT id,title,year,replace(normal,'  ',' ') FROM titles WHERE instr(normal,'  ')>0
    ) SELECT id,title,year,
      (SELECT external_id FROM movie_external_ids WHERE movie_id=t.id AND provider='tmdb') AS tmdbId,
      (SELECT reference FROM movie_assets WHERE movie_id=t.id AND asset_type='poster' ORDER BY preferred DESC,id LIMIT 1) AS poster
    FROM titles t WHERE instr(normal,'  ')=0 AND (
      instr(CASE WHEN normal LIKE 'the %' THEN substr(normal,5) WHEN normal LIKE 'a %' THEN substr(normal,3) ELSE normal END,?)>0
      OR normal GLOB '*[^ -~]*'
      ${tmdbIds.length ? `OR id IN (SELECT movie_id FROM movie_external_ids WHERE provider='tmdb' AND external_id IN (${tmdbIds.map(() => '?').join(',')}))` : ''}
    ) ORDER BY title COLLATE NOCASE,id`).bind(normalizeTitle(query),...tmdbIds).all<SavedSearchResult>()).results;
    // SQLite lower() is ASCII-only. Narrow non-ASCII candidates still use the
    // shared Unicode case/whitespace rule before being returned to the service.
    const identities = new Set(tmdbIds), term = normalizeTitle(query);
    return rows.filter(movie => normalizeTitle(movie.title).includes(term) || (movie.tmdbId !== null && identities.has(movie.tmdbId)));
  }
  private async catalogSnapshot(compact = false): Promise<Catalog> {
    const director = await this.hasDirector();
    // D1 batch gives one consistent transactional read for the derived rankings.
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      this.db.prepare(`SELECT id,title,original_title,year,release_date,runtime,overview,${director ? 'director' : 'NULL AS director'},tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies ORDER BY title,id`),
      this.db.prepare('SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets ORDER BY preferred DESC,id'),
      this.db.prepare('SELECT movie_id,provider,external_id FROM movie_external_ids'),
      this.db.prepare(compact ? effectiveScoreSql() : 'SELECT movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at,source_ref,source_ordinal,legacy_preferred FROM source_scores ORDER BY fetched_at,id'),
      this.db.prepare('SELECT movie_id,member_id,seen,updated_at FROM seen_states'),
      this.db.prepare('SELECT movie_id,rank_seed,added_at,source FROM classics'),
      this.db.prepare('SELECT movie_id,genre FROM movie_genres ORDER BY genre'),
      this.db.prepare('SELECT id,event_date,host_member_id,legacy_cycle_label,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,completed_turn_version,EXISTS(SELECT 1 FROM history_audit WHERE session_id=sessions.id) AS has_audit FROM sessions WHERE deleted_at IS NULL ORDER BY event_date DESC,created_at DESC,id'),
      this.db.prepare('SELECT sm.session_id,sm.movie_id,sm.position FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL ORDER BY sm.position'),
      this.db.prepare('SELECT * FROM cycles ORDER BY ordinal DESC,id'),
    ]);
    const rows = <T>(i: number) => result[i].results as T[];
    const members = rows<Member>(0);
    const movies = assembleMovies(result,compact);
    const movieMap = new Map(movies.map(m => [m.id,m]));
    const lineups = new Map<string,string[]>();
    for (const row of rows<{session_id:string;movie_id:string}>(9)) {
      const group = lineups.get(row.session_id) ?? []; group.push(row.movie_id); lineups.set(row.session_id,group);
    }
    const sessions = rows<SessionRow>(8).map(s => ({ ...s, has_audit: Boolean(s.has_audit),
      movies: (lineups.get(s.id) ?? []).map(id => movieMap.get(id)!).filter(Boolean) }));
    return { members, movies, sessions, cycles: rows<Cycle>(10) };
  }
  async catalog(): Promise<Catalog> { return this.catalogSnapshot(); }
  async compactCatalog(): Promise<CompactCatalog> {
    const catalog = await this.catalogSnapshot(true);
    return {...catalog,sessions:catalog.sessions.map(({movies,...session}) => ({...session,movie_ids:movies.map(m => m.id)}))};
  }
  async members(): Promise<Member[]> {
    return (await this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id').all<Member>()).results;
  }
  async cycles(): Promise<Cycle[]> { return (await this.db.prepare('SELECT * FROM cycles ORDER BY ordinal DESC,id').all<Cycle>()).results; }
  async movies(classicsOnly = false): Promise<Movie[]> {
    return this.movieCollection(classicsOnly ? 'id IN (SELECT movie_id FROM classics)' : '1=1');
  }
  private movieStatements(scope:string, values:string[], director:boolean): D1PreparedStatement[] {
    const selected = `SELECT id FROM movies WHERE ${scope}`;
    const scoped = (sql:string) => this.db.prepare(sql).bind(...values);
    return [
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      scoped(`SELECT id,title,original_title,year,release_date,runtime,overview,${director ? 'director' : 'NULL AS director'},tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies WHERE ${scope} ORDER BY title,id`),
      scoped(`SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets WHERE movie_id IN (${selected}) ORDER BY preferred DESC,id`),
      scoped(`SELECT movie_id,provider,external_id FROM movie_external_ids WHERE movie_id IN (${selected}) ORDER BY rowid`),
      scoped(`SELECT movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at,source_ref,source_ordinal,legacy_preferred FROM source_scores WHERE movie_id IN (${selected}) ORDER BY fetched_at,id`),
      scoped(`SELECT movie_id,member_id,seen,updated_at FROM seen_states WHERE movie_id IN (${selected}) ORDER BY rowid`),
      scoped(`SELECT movie_id,rank_seed,added_at,source FROM classics WHERE movie_id IN (${selected})`),
      scoped(`SELECT movie_id,genre FROM movie_genres WHERE movie_id IN (${selected}) ORDER BY genre`),
    ];
  }
  private async movieCollection(scope:string, values:string[] = []): Promise<Movie[]> {
    return assembleMovies(await this.db.batch(this.movieStatements(scope,values,await this.hasDirector())));
  }
  async sessions(id?:string): Promise<Session[]> {
    const where = id ? ' AND id=?' : '';
    const query = this.db.prepare(`SELECT id,event_date,host_member_id,legacy_cycle_label,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,completed_turn_version,EXISTS(SELECT 1 FROM history_audit WHERE session_id=sessions.id) AS has_audit FROM sessions WHERE deleted_at IS NULL${where} ORDER BY event_date DESC,created_at DESC,id`);
    const joins = this.db.prepare(`SELECT sm.session_id,sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL${id ? ' AND s.id=?' : ''} ORDER BY sm.position`);
    const scope = `id IN (SELECT sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL${id ? ' AND s.id=?' : ''})`;
    const result = await this.db.batch([...this.movieStatements(scope,id ? [id] : [],await this.hasDirector()),...(id ? [query.bind(id),joins.bind(id)] : [query,joins])]);
    const lineups = new Map<string,string[]>();
    for (const row of result[9].results as {session_id:string;movie_id:string}[]) {
      const group = lineups.get(row.session_id) ?? []; group.push(row.movie_id); lineups.set(row.session_id,group);
    }
    const movies = assembleMovies(result);
    const byId = new Map(movies.map(m => [m.id,m]));
    return (result[8].results as SessionRow[]).map(s => ({...s,has_audit:Boolean(s.has_audit),movies:(lineups.get(s.id) ?? []).map(id => byId.get(id)!).filter(Boolean)}));
  }
  async session(id:string): Promise<Session> {
    const session = (await this.sessions(id))[0];
    if (!session) throw new ApiError(404,'NOT_FOUND','Event not found.');
    return session;
  }
  /** Selected-film snapshot; never loads unrelated movies, relationships or cycles. */
  async movieDetails(ids: string[], validateScope = false): Promise<import('../../shared/types').MovieDetail[]> {
    if (!ids.length) return [];
    const director = await this.hasDirector();
    const placeholders = ids.map(() => '?').join(',');
    const selected = (sql: string) => this.db.prepare(sql).bind(...ids);
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      selected(`SELECT id,title,original_title,year,release_date,runtime,overview,${director ? 'director' : 'NULL AS director'},tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies WHERE id IN (${placeholders})`),
      selected(`SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets WHERE movie_id IN (${placeholders}) ORDER BY preferred DESC,id`),
      selected(`SELECT movie_id,provider,external_id FROM movie_external_ids WHERE movie_id IN (${placeholders})`),
      selected(`SELECT movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at,source_ref,source_ordinal,legacy_preferred FROM source_scores WHERE movie_id IN (${placeholders}) ORDER BY fetched_at,id`),
      selected(`SELECT movie_id,member_id,seen,updated_at FROM seen_states WHERE movie_id IN (${placeholders})`),
      selected(`SELECT movie_id,rank_seed,added_at,source FROM classics WHERE movie_id IN (${placeholders})`),
      selected(`SELECT movie_id,genre FROM movie_genres WHERE movie_id IN (${placeholders}) ORDER BY genre`),
      selected(`SELECT sm.movie_id,s.id,s.event_date,s.date_precision,s.kind,s.host_member_id,sm.position FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL AND sm.movie_id IN (${placeholders}) ORDER BY s.event_date DESC,s.created_at DESC,s.id,sm.position`),
    ]);
    const rows = <T>(i: number) => result[i].results as T[];
    const appearances = groupMovies(rows<WithMovie<import('../../shared/types').MovieDetail['appearances'][number]>>(8));
    const movies = assembleMovies(result).map(movie => ({...movie,appearances:appearances.get(movie.id) ?? []}));
    const byId = new Map(movies.map(m => [m.id,m]));
    return ids.map(id => {
      const movie = byId.get(id);
      if (validateScope && (!movie || (!movie.classic && !movie.appearances.length)))
        throw new ApiError(422,'INVALID_SCOPE','Maintenance only covers Classics and History films.');
      if (!movie) throw new ApiError(404,'NOT_FOUND','Film not found.');
      return movie;
    });
  }
  /** Maintenance adds scope validation to the shared selected-film loader. */
  async maintenanceDetails(ids: string[], validateScope = false) {
    return this.movieDetails(ids,validateScope);
  }
  async scoreChecks(ids: string[]) {
    if (!ids.length) return [];
    return (await this.db.prepare(`SELECT movie_id,score_key,available FROM movie_score_checks WHERE movie_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{movie_id:string;score_key:string;available:number}>()).results;
  }
  async saveScoreChecks(id: string, checks: {key:string;available:boolean}[]) {
    if (!checks.length) return;
    const at = new Date().toISOString();
    await this.db.batch(checks.map(check => this.db.prepare(`INSERT INTO movie_score_checks(movie_id,score_key,available,checked_at) VALUES(?,?,?,?) ON CONFLICT(movie_id,score_key) DO UPDATE SET available=excluded.available,checked_at=excluded.checked_at`).bind(id,check.key,Number(check.available),at)));
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
    const marks = ids.map(() => '?').join(','), director = await this.hasDirector();
    const result = await this.db.batch([
      this.db.prepare(`SELECT id,title,original_title,release_date,runtime,overview,${director ? 'director' : 'NULL AS director'},tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies WHERE id IN (${marks})`).bind(...ids),
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
    const sql = metadataSql(await this.hasDirector(),true);
    const rows = (await this.db.prepare(`${sql}
      SELECT id,title,original_title,release_date,runtime,overview,metadata_director AS director,tmdb_metadata_checked_at,tmdb_artwork_checked_at,tmdb_id,poster,backdrop
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
    return (await this.db.prepare(`${metadataSql(await this.hasDirector(),false)}
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
  async assertMovie(id: string) {
    if (!await this.db.prepare('SELECT id FROM movies WHERE id=?').bind(id).first()) throw new ApiError(404,'NOT_FOUND','Film not found.');
  }
  async manualMovie(input: ManualMovieInput): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare('INSERT INTO movies(id,title,year,runtime) VALUES(?,?,?,?)').bind(id,input.title,input.year ?? null,input.runtime ?? null).run();
    return id;
  }
  async saveSession(input: SessionInput, existingId?: string) {
    return new ProductRepository(this.db).saveSession(input,null,existingId);
  }
  async setSeen(movieId: string, memberId: string, seen: boolean | null) {
    await this.assertMovie(movieId);
    if (!await this.db.prepare('SELECT id FROM members WHERE id=? AND active=1').bind(memberId).first()) throw new ApiError(404,'NOT_FOUND','Active member not found.');
    if (seen === null) await this.db.prepare('DELETE FROM seen_states WHERE movie_id=? AND member_id=?').bind(movieId,memberId).run();
    else await this.db.prepare("INSERT INTO seen_states(movie_id,member_id,seen) VALUES(?,?,?) ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=excluded.seen,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(movieId,memberId,seen ? 1 : 0).run();
  }
  async findExternal(provider: string, externalId: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT movie_id FROM movie_external_ids WHERE provider=? AND external_id=?').bind(provider,externalId).first<{movie_id: string}>();
    return row?.movie_id ?? null;
  }
  async setClassic(id: string, classic: boolean) {
    await this.assertMovie(id);
    if (classic) await this.db.prepare("INSERT OR IGNORE INTO classics(movie_id,source) VALUES(?,'member-added')").bind(id).run();
    else await this.db.prepare('DELETE FROM classics WHERE movie_id=?').bind(id).run();
  }
  async appendScores(id: string, scores: Score[]) {
    await this.assertMovie(id);
    const unique = new Map(scores.map(s => [`${s.provider}:${s.metric}:${s.retrieved_via ?? 'unspecified'}`,s]));
    const statements = [...unique.values()].map(s => this.db.prepare('INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via ?? 'unspecified',s.upstream_updated_at ?? null));
    if (statements.length) await this.db.batch(statements);
  }
  async importMovie(m: ProviderMovie): Promise<string> {
    // Persist the entire provider-neutral snapshot atomically; IDs enforce import safety.
    const id = crypto.randomUUID();
    const director = await this.hasDirector();
    const checkedAt = m.external_ids.some(e => e.provider === 'tmdb') ? m.fetched_at : null;
    const statements = [this.db.prepare(`INSERT INTO movies(id,title,original_title,year,release_date,runtime,overview,${director ? 'director,' : ''}tmdb_metadata_checked_at,tmdb_artwork_checked_at) VALUES(?,?,?,?,?,?,?,${director ? '?,' : ''}?,?)`)
      .bind(id,m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview,...(director ? [m.director ?? null] : []),checkedAt,checkedAt)];
    statements.push(...m.external_ids.map(e => this.db.prepare('INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?)').bind(id,e.provider,e.external_id)));
    statements.push(...m.genres.map(g => this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,g)));
    statements.push(...m.assets.map(a => this.db.prepare('INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,width,height,preferred,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,a.provider,a.asset_type,a.reference,a.width,a.height,a.preferred,m.fetched_at)));
    statements.push(...m.scores.map(s => this.db.prepare('INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via ?? 'tmdb')));
    await this.db.batch(statements);
    return id;
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
  async enrichOmdbMetadata(id: string, imdbId: string, metadata: import('./providers/omdb').OmdbMetadata) {
    const director = await this.hasDirector();
    const owner = await this.findExternal('imdb',imdbId);
    if (owner !== id) throw new ApiError(409,'IDENTITY_CONFLICT','Stored IMDb identity changed. Refresh before retrying.');
    const statements = [this.db.prepare(`UPDATE movies SET year=COALESCE(?,year),runtime=COALESCE(?,runtime),${director ? 'director=COALESCE(?,director),' : ''}updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider='imdb' AND external_id=?)`)
      .bind(metadata.year,metadata.runtime,...(director ? [metadata.director] : []),id,id,imdbId)];
    if (metadata.genres.length) {
      statements.push(this.db.prepare('DELETE FROM movie_genres WHERE movie_id=?').bind(id));
      for (const genre of new Set(metadata.genres)) statements.push(this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,genre));
    }
    await this.db.batch(statements);
  }
  async enrichMetadata(id: string, tmdbId: string, m: ProviderMovie, attachment?: {import_source: string; source_refs: string[]}, captureScores = false) {
    await this.assertMovie(id);
    if (!m.external_ids.some(e => e.provider === 'tmdb' && e.external_id === tmdbId))
      throw new ApiError(409,'IDENTITY_CONFLICT','TMDB returned a different identity. Owner reconciliation is required.');
    const ids = (await this.db.prepare('SELECT provider,external_id FROM movie_external_ids WHERE movie_id=?').bind(id).all<ExternalId>()).results;
    if (attachment ? ids.some(e => e.provider === 'tmdb') : !ids.some(e => e.provider === 'tmdb' && e.external_id === tmdbId)) throw new ApiError(409,'IDENTITY_CONFLICT','Stored TMDB identity changed. Refresh before retrying.');
    const imdb = m.external_ids.find(e => e.provider === 'imdb');
    const knownImdb = ids.find(e => e.provider === 'imdb');
    if (imdb) {
      const owner = await this.findExternal('imdb',imdb.external_id);
      if ((owner && owner !== id) || (knownImdb && knownImdb.external_id !== imdb.external_id))
        throw new ApiError(409,'IDENTITY_CONFLICT','IMDb identity conflicts with a canonical film. Owner reconciliation is required.');
    }
    const statements = this.metadataStatements(id,m,captureScores,await this.hasDirector());
    if (attachment) {
      // Fail the whole batch if provenance or identity changed since preflight.
      statements.unshift(this.db.prepare(`INSERT INTO movie_external_ids(movie_id,provider,external_id)
        VALUES(?,'tmdb',CASE WHEN
          EXISTS(SELECT 1 FROM movies WHERE id=? AND import_source=? AND import_key=?)
          AND NOT EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=?)
          AND (SELECT count(*) FROM movie_import_refs WHERE movie_id=?)=?
          AND NOT EXISTS(SELECT 1 FROM movie_import_refs WHERE movie_id=? AND (import_source<>? OR source_ref NOT IN (${attachment.source_refs.map(() => '?').join(',')})))
          THEN ? ELSE NULL END)`)
        .bind(id,id,attachment.import_source,id,id,id,attachment.source_refs.length,id,attachment.import_source,...attachment.source_refs,tmdbId));
    }
    try { await this.db.batch(statements); }
    catch (error) {
      if (/movie_external_ids/.test(String(error))) throw new ApiError(409,'IDENTITY_CONFLICT','External identity conflicts with a canonical film. Owner reconciliation is required.');
      throw error;
    }
  }
  // Internal batch builder: callers must validate identity/ownership before executing.
  // Also used inside the local canonical-merge transaction, from the same details response.
  metadataStatements(id: string, m: ProviderMovie, captureScores = false,director = true): D1PreparedStatement[] {
    const imdb = m.external_ids.find(e => e.provider === 'imdb');
    const statements = [this.db.prepare(`UPDATE movies SET title=?,original_title=?,year=?,release_date=?,runtime=?,overview=?,${director ? 'director=?,' : ''}tmdb_metadata_checked_at=?,tmdb_artwork_checked_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview,...(director ? [m.director ?? null] : []),m.fetched_at,m.fetched_at,id)];
    // Recheck ownership transactionally even when an identical ID is already stored.
    if (imdb) statements.push(this.db.prepare('INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?) ON CONFLICT(movie_id,provider) DO UPDATE SET external_id=CASE WHEN movie_external_ids.external_id=excluded.external_id THEN excluded.external_id ELSE NULL END')
      .bind(id,'imdb',imdb.external_id));
    statements.push(this.db.prepare('DELETE FROM movie_genres WHERE movie_id=?').bind(id));
    statements.push(...[...new Set(m.genres)].map(g => this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,g)));
    for (const asset of m.assets.filter(a => a.provider === 'tmdb')) {
      statements.push(this.db.prepare('UPDATE movie_assets SET preferred=0 WHERE movie_id=? AND asset_type=?').bind(id,asset.asset_type),
        this.db.prepare(`INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,width,height,preferred,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(movie_id,provider,asset_type,reference) DO UPDATE SET preferred=1,width=excluded.width,height=excluded.height,fetched_at=excluded.fetched_at`)
          .bind(crypto.randomUUID(),id,'tmdb',asset.asset_type,asset.reference,asset.width,asset.height,1,m.fetched_at));
    }
    if(captureScores)statements.push(...m.scores.map(s=>this.db.prepare('INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via??'tmdb',s.upstream_updated_at??null)));
    return statements;
  }
}
