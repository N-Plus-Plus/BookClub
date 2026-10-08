import type { Catalog, CompactCatalog, Cycle, Member, Movie, Session, SavedSearchResult } from '../../shared/types';
import { normalizeTitle } from '../../shared/search';
import { australianClassification } from '../../shared/metrics-enrichment/classification';
import { assembleMovies, groupMovies } from './catalog-assembly';
import { effectiveScoreSql, scoreColumns } from './score-sql';
import { movieColumns } from './movie-projections';
import { ApiError } from './http';
import { SchemaCapabilities } from './schema-capabilities';

type SessionRow = Omit<Session,'movies'>;
type WithMovie<T> = T & { movie_id: string };

export class CatalogRepository {
  constructor(private db: D1Database, private capabilities = new SchemaCapabilities(db)) {}

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
    const director = await this.capabilities.hasDirector();
    const enrichment = await this.capabilities.enrichmentSupported();
    // D1 batch gives one consistent transactional read for the derived rankings.
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      this.db.prepare(`SELECT ${movieColumns(director)} FROM movies ORDER BY title,id`),
      this.db.prepare('SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets ORDER BY preferred DESC,id'),
      this.db.prepare('SELECT movie_id,provider,external_id FROM movie_external_ids'),
      this.db.prepare(compact ? effectiveScoreSql() : `SELECT ${scoreColumns} FROM source_scores ORDER BY fetched_at,id`),
      this.db.prepare('SELECT movie_id,member_id,seen,updated_at FROM seen_states'),
      this.db.prepare('SELECT movie_id,rank_seed,added_at,source FROM classics'),
      this.db.prepare('SELECT movie_id,genre FROM movie_genres ORDER BY genre'),
      this.db.prepare('SELECT id,created_at,event_date,host_member_id,legacy_cycle_label,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,completed_turn_version,EXISTS(SELECT 1 FROM history_audit WHERE session_id=sessions.id) AS has_audit FROM sessions WHERE deleted_at IS NULL ORDER BY event_date DESC,created_at DESC,id'),
      this.db.prepare('SELECT sm.session_id,sm.movie_id,sm.position FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL ORDER BY sm.position'),
      this.db.prepare('SELECT * FROM cycles ORDER BY ordinal DESC,id'),
      this.db.prepare(enrichment ? "SELECT movie_id,certification,release_type FROM movie_provider_content_ratings WHERE provider='tmdb' AND country='AU'" : 'SELECT NULL AS movie_id,NULL AS certification,NULL AS release_type WHERE 0'),
    ]);
    const rows = <T>(i: number) => result[i].results as T[];
    const members = rows<Member>(0);
    const movies = assembleMovies(result,compact);
    const ratings = groupMovies(rows<{movie_id:string;certification:string;release_type:number | null}>(11));
    for (const movie of movies) {
      const value = australianClassification({contentRatings:ratings.get(movie.id) ?? []});
      if (value !== 'Unknown') movie.au_classification = value;
    }
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
      scoped(`SELECT ${movieColumns(director)} FROM movies WHERE ${scope} ORDER BY title,id`),
      scoped(`SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets WHERE movie_id IN (${selected}) ORDER BY preferred DESC,id`),
      scoped(`SELECT movie_id,provider,external_id FROM movie_external_ids WHERE movie_id IN (${selected}) ORDER BY rowid`),
      scoped(`SELECT ${scoreColumns} FROM source_scores WHERE movie_id IN (${selected}) ORDER BY fetched_at,id`),
      scoped(`SELECT movie_id,member_id,seen,updated_at FROM seen_states WHERE movie_id IN (${selected}) ORDER BY rowid`),
      scoped(`SELECT movie_id,rank_seed,added_at,source FROM classics WHERE movie_id IN (${selected})`),
      scoped(`SELECT movie_id,genre FROM movie_genres WHERE movie_id IN (${selected}) ORDER BY genre`),
    ];
  }

  private async movieCollection(scope:string, values:string[] = []): Promise<Movie[]> {
    return assembleMovies(await this.db.batch(this.movieStatements(scope,values,await this.capabilities.hasDirector())));
  }

  async sessions(id?:string): Promise<Session[]> {
    const where = id ? ' AND id=?' : '';
    const query = this.db.prepare(`SELECT id,created_at,event_date,host_member_id,legacy_cycle_label,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,completed_turn_version,EXISTS(SELECT 1 FROM history_audit WHERE session_id=sessions.id) AS has_audit FROM sessions WHERE deleted_at IS NULL${where} ORDER BY event_date DESC,created_at DESC,id`);
    const joins = this.db.prepare(`SELECT sm.session_id,sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL${id ? ' AND s.id=?' : ''} ORDER BY sm.position`);
    const scope = `id IN (SELECT sm.movie_id FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE s.deleted_at IS NULL${id ? ' AND s.id=?' : ''})`;
    const result = await this.db.batch([...this.movieStatements(scope,id ? [id] : [],await this.capabilities.hasDirector()),...(id ? [query.bind(id),joins.bind(id)] : [query,joins])]);
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
    const director = await this.capabilities.hasDirector();
    const placeholders = ids.map(() => '?').join(',');
    const selected = (sql: string) => this.db.prepare(sql).bind(...ids);
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      selected(`SELECT ${movieColumns(director)} FROM movies WHERE id IN (${placeholders})`),
      selected(`SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets WHERE movie_id IN (${placeholders}) ORDER BY preferred DESC,id`),
      selected(`SELECT movie_id,provider,external_id FROM movie_external_ids WHERE movie_id IN (${placeholders})`),
      selected(`SELECT ${scoreColumns} FROM source_scores WHERE movie_id IN (${placeholders}) ORDER BY fetched_at,id`),
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
        throw new ApiError(422,'INVALID_SCOPE','A queued film was deleted or is no longer in Classics or History. Refresh BookClub before resuming.');
      if (!movie) throw new ApiError(404,'NOT_FOUND','Film not found.');
      return movie;
    });
  }
}
