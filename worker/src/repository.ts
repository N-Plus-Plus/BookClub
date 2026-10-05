import type { Asset, Catalog, Cycle, ExternalId, Member, Movie, Score, SeenAnswer, Session, SessionInput, ManualMovieInput } from '../../shared/types';
import { rankMovie } from '../../shared/ranking';
import type { ProviderMovie } from './providers/types';
import { ApiError } from './http';
import { ProductRepository } from './product-repository';

type MovieRow = Pick<Movie, 'id' | 'title' | 'original_title' | 'year' | 'release_date' | 'runtime' | 'overview' | 'tmdb_metadata_checked_at' | 'tmdb_artwork_checked_at'>;
type SessionRow = Omit<Session,'movies'>;
type WithMovie<T> = T & { movie_id: string };

export class Repository {
  constructor(private db: D1Database) {}
  async catalog(): Promise<Catalog> {
    // D1 batch gives one consistent transactional read for the derived rankings.
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active,avatar FROM members ORDER BY sort_order,id'),
      this.db.prepare('SELECT id,title,original_title,year,release_date,runtime,overview,tmdb_metadata_checked_at,tmdb_artwork_checked_at FROM movies ORDER BY title,id'),
      this.db.prepare('SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets ORDER BY preferred DESC,id'),
      this.db.prepare('SELECT movie_id,provider,external_id FROM movie_external_ids'),
      this.db.prepare('SELECT movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at,source_ref,source_ordinal,legacy_preferred FROM source_scores ORDER BY fetched_at,id'),
      this.db.prepare('SELECT movie_id,member_id,seen,updated_at FROM seen_states'),
      this.db.prepare('SELECT movie_id,rank_seed,added_at,source FROM classics'),
      this.db.prepare('SELECT movie_id,genre FROM movie_genres ORDER BY genre'),
      this.db.prepare('SELECT id,event_date,title,host_member_id,legacy_cycle_label,notes,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,swap_note,completed_turn_version FROM sessions WHERE deleted_at IS NULL ORDER BY event_date DESC,created_at DESC,id'),
      this.db.prepare('SELECT session_id,movie_id,position FROM session_movies ORDER BY position'),
      this.db.prepare('SELECT * FROM cycles ORDER BY ordinal DESC,id'),
    ]);
    const rows = <T>(i: number) => result[i].results as T[];
    const members = rows<Member>(0);
    const movies = rows<MovieRow>(1).map(m => {
      const scores = rows<WithMovie<Score>>(4).filter(s => s.movie_id === m.id);
      const seen = rows<WithMovie<SeenAnswer>>(5).filter(s => s.movie_id === m.id);
      const membership = rows<{movie_id: string; rank_seed: number; added_at: string; source: string | null}>(6).find(c => c.movie_id === m.id);
      const classic = Boolean(membership);
      return { ...m, scores, seen, classic, classics_membership: membership ?? null, ranking: membership ? rankMovie(scores,seen,members,membership.rank_seed) : null,
        genres: rows<{movie_id: string; genre: string}>(7).filter(g => g.movie_id === m.id).map(g => g.genre),
        assets: rows<WithMovie<Asset>>(2).filter(a => a.movie_id === m.id),
        external_ids: rows<WithMovie<ExternalId>>(3).filter(e => e.movie_id === m.id) };
    });
    const movieMap = new Map(movies.map(m => [m.id,m]));
    const sessions = rows<SessionRow>(8).map(s => ({ ...s,
      movies: rows<{session_id: string; movie_id: string; position: number}>(9)
        .filter(j => j.session_id === s.id).map(j => movieMap.get(j.movie_id)!).filter(Boolean) }));
    return { members, movies, sessions, cycles: rows<Cycle>(10) };
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
    const checkedAt = m.external_ids.some(e => e.provider === 'tmdb') ? m.fetched_at : null;
    const statements = [this.db.prepare('INSERT INTO movies(id,title,original_title,year,release_date,runtime,overview,tmdb_metadata_checked_at,tmdb_artwork_checked_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id,m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview,checkedAt,checkedAt)];
    statements.push(...m.external_ids.map(e => this.db.prepare('INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?)').bind(id,e.provider,e.external_id)));
    statements.push(...m.genres.map(g => this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,g)));
    statements.push(...m.assets.map(a => this.db.prepare('INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,width,height,preferred,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,a.provider,a.asset_type,a.reference,a.width,a.height,a.preferred,m.fetched_at)));
    statements.push(...m.scores.map(s => this.db.prepare('INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via ?? 'tmdb')));
    await this.db.batch(statements);
    return id;
  }
  async providerCooldown(provider: string): Promise<number | null> {
    const row = await this.db.prepare('SELECT retry_after_until FROM provider_cooldowns WHERE provider=?').bind(provider).first<{retry_after_until:string}>();
    if (!row) return null; const seconds = Math.ceil((Date.parse(row.retry_after_until)-Date.now())/1000);
    if (seconds > 0) return seconds;
    await this.db.prepare('DELETE FROM provider_cooldowns WHERE provider=?').bind(provider).run(); return null;
  }
  async setProviderCooldown(provider: string, seconds: number) {
    const now = new Date(), until = new Date(now.getTime()+Math.max(0,seconds)*1000).toISOString();
    await this.db.prepare('INSERT INTO provider_cooldowns(provider,retry_after_until,updated_at) VALUES(?,?,?) ON CONFLICT(provider) DO UPDATE SET retry_after_until=excluded.retry_after_until,updated_at=excluded.updated_at').bind(provider,until,now.toISOString()).run();
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
    const statements = this.metadataStatements(id,m,captureScores);
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
  metadataStatements(id: string, m: ProviderMovie, captureScores = false): D1PreparedStatement[] {
    const imdb = m.external_ids.find(e => e.provider === 'imdb');
    const statements = [this.db.prepare(`UPDATE movies SET title=?,original_title=?,year=?,release_date=?,runtime=?,overview=?,tmdb_metadata_checked_at=?,tmdb_artwork_checked_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview,m.fetched_at,m.fetched_at,id)];
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
