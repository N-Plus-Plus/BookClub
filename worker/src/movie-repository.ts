import type { ExternalId, ManualMovieInput, Score } from '../../shared/types';
import type { EnrichmentCapture } from '../../shared/enrichment';
import { normalizeGenre } from '../../shared/genres';
import type { ProviderMovie } from './providers/types';
import { ProviderEvidenceRepository } from './provider-evidence-repository';
import { EnrichmentRepository } from './enrichment-repository';
import { TitleRepository, providerTitleStatement, canonicalTitleStatement } from './title-repository';
import { ApiError } from './http';
import { SchemaCapabilities } from './schema-capabilities';

export class MovieRepository {
  constructor(private db: D1Database, private capabilities = new SchemaCapabilities(db)) {}

  async cacheEnrichment(id: string, capture: EnrichmentCapture) {
    const supported=await this.capabilities.enrichmentSupported();
    if (!supported) return {changed:false,canonicalChanged:false,conflicts:0,unsupported:true};
    return new EnrichmentRepository(this.db).save(id,capture);
  }

  async cacheProviderTitle(id: string, provider: string, title: unknown, identity: ExternalId, at: string) {
    if (!await new TitleRepository(this.db).supported()) return;
    const statement=providerTitleStatement(this.db,id,provider,title,identity,at);
    await this.db.batch([...(statement ? [statement] : []),canonicalTitleStatement(this.db,id,identity)]);
  }

  async assertMovie(id: string) {
    if (!await this.db.prepare('SELECT id FROM movies WHERE id=?').bind(id).first()) throw new ApiError(404,'NOT_FOUND','Film not found.');
  }

  async manualMovie(input: ManualMovieInput): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare('INSERT INTO movies(id,title,year,runtime) VALUES(?,?,?,?)').bind(id,input.title,input.year ?? null,input.runtime ?? null).run();
    return id;
  }

  async setSeen(movieId: string, memberId: string, seen: boolean | null) {
    await this.assertMovie(movieId);
    if (!await this.db.prepare('SELECT id FROM members WHERE id=? AND active=1').bind(memberId).first()) throw new ApiError(404,'NOT_FOUND','Active member not found.');
    // Evaluate History inside the write transaction: queued No/null answers may
    // arrive after publication, but cannot undo active History's Seen evidence.
    const history = 'EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=? AND s.deleted_at IS NULL)';
    await this.db.batch([
      ...(seen === null ? [this.db.prepare(`DELETE FROM seen_states WHERE movie_id=? AND member_id=? AND NOT ${history}`).bind(movieId,memberId,movieId)] : []),
      this.db.prepare(`INSERT INTO seen_states(movie_id,member_id,seen) SELECT ?,?,CASE WHEN ${history} THEN 1 ELSE ? END
        WHERE ? IS NOT NULL OR ${history}
        ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=excluded.seen,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
        .bind(movieId,memberId,movieId,seen === null ? null : Number(seen),seen === null ? null : Number(seen),movieId),
    ]);
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

  async removeClassic(id: string) {
    await this.assertMovie(id);
    if (!await this.db.prepare('SELECT movie_id FROM classics WHERE movie_id=?').bind(id).first()) throw new ApiError(404,'NOT_FOUND','Classic not found.');
    await this.db.batch([
      this.db.prepare('DELETE FROM seen_states WHERE movie_id=? AND EXISTS(SELECT 1 FROM classics WHERE movie_id=?)').bind(id,id),
      this.db.prepare('DELETE FROM classics WHERE movie_id=?').bind(id),
      this.db.prepare("INSERT INTO seen_states(movie_id,member_id,seen) SELECT ?,id,1 FROM members WHERE active=1 AND EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=? AND s.deleted_at IS NULL) ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(id,id),
    ]);
  }

  async appendScores(id: string, scores: Score[], identity?:ExternalId) {
    await this.assertMovie(id);
    const unique = new Map(scores.map(s => [`${s.provider}:${s.metric}:${s.retrieved_via ?? 'unspecified'}`,s]));
    const statements = [...unique.values()].map(s => this.db.prepare(`INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via,upstream_updated_at) VALUES(?,${identity ? 'CASE WHEN EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?) THEN ? ELSE NULL END' : '?'},?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),...(identity ? [id,identity.provider,identity.external_id,id] : [id]),s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via ?? 'unspecified',s.upstream_updated_at ?? null));
    if (statements.length) await this.db.batch(statements);
  }

  async importMovie(m: ProviderMovie): Promise<string> {
    // Persist the entire provider-neutral snapshot atomically; IDs enforce import safety.
    const id = crypto.randomUUID();
    const director = await this.capabilities.hasDirector();
    const checkedAt = m.external_ids.some(e => e.provider === 'tmdb') ? m.fetched_at : null;
    const statements = [this.db.prepare(`INSERT INTO movies(id,title,original_title,year,release_date,runtime,overview,${director ? 'director,' : ''}tmdb_metadata_checked_at,tmdb_artwork_checked_at) VALUES(?,?,?,?,?,?,?,${director ? '?,' : ''}?,?)`)
      .bind(id,m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview,...(director ? [m.director ?? null] : []),checkedAt,checkedAt)];
    statements.push(...m.external_ids.map(e => this.db.prepare('INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?)').bind(id,e.provider,e.external_id)));
    statements.push(...m.genres.map(g => this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,g)));
    statements.push(...m.assets.map(a => this.db.prepare('INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,width,height,preferred,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,a.provider,a.asset_type,a.reference,a.width,a.height,a.preferred,m.fetched_at)));
    statements.push(...m.scores.map(s => this.db.prepare('INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,retrieved_via) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at,s.retrieved_via ?? 'tmdb')));
    if (await new TitleRepository(this.db).supported()) {
      const identity=m.external_ids.find(e=>e.provider==='tmdb');
      if (identity) {
        const title=providerTitleStatement(this.db,id,'tmdb',m.title,identity,m.fetched_at);
        if (title) statements.push(title);
        statements.push(canonicalTitleStatement(this.db,id));
      }
    }
    await this.db.batch(statements);
    await new ProviderEvidenceRepository(this.db).save(id,'collections',m.collection);
    if (m.enrichment) await this.cacheEnrichment(id,m.enrichment);
    return id;
  }

  async enrichOmdbMetadata(id: string, imdbId: string, metadata: Omit<import('./providers/omdb').OmdbMetadata,'title'> & {title?: string | null}, populate = false) {
    const director = await this.capabilities.hasDirector();
    const owner = await this.findExternal('imdb',imdbId);
    if (owner !== id) throw new ApiError(409,'IDENTITY_CONFLICT','Stored IMDb identity changed. Refresh before retrying.');
    const current = await this.db.prepare(`SELECT year,runtime,${director ? 'director' : 'NULL AS director'} FROM movies WHERE id=?`).bind(id).first<{year:number | null;runtime:number | null;director:string | null}>();
    if (!current) throw new ApiError(404,'NOT_FOUND','Queued film was deleted. Refresh before resuming.');
    const stored = (await this.db.prepare('SELECT genre FROM movie_genres WHERE movie_id=?').bind(id).all<{genre:string}>()).results.map(r => r.genre);
    // Known aliases share the presentation vocabulary; unknown IMDb genres remain meaningful.
    const canonical = (genre: string) => normalizeGenre(genre) ?? genre;
    const desired = new Set(metadata.genres.map(canonical)), existing = new Set(stored.map(canonical));
    const fields = (['year','runtime',...(director ? ['director'] as const : [])] as const)
      .filter(field => metadata[field] !== null && metadata[field] !== current[field] && (!populate || current[field] === null || typeof current[field]==='string' && !current[field].trim()));
    const guard = "EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider='imdb' AND external_id=?)";
    const statements: D1PreparedStatement[] = [];
    if (fields.length) statements.push(this.db.prepare(`UPDATE movies SET ${fields.map(field => `${field}=?`).join(',')},updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND ${guard} AND (${fields.map(field => `${field} IS NOT ?`).join(' OR ')}) RETURNING id`)
      .bind(...fields.map(field => metadata[field]),id,id,imdbId,...fields.map(field => metadata[field])));
    if (desired.size && (!populate || !existing.size)) {
      for (const genre of stored.filter(g => !desired.has(canonical(g))))
        statements.push(this.db.prepare(`DELETE FROM movie_genres WHERE movie_id=? AND genre=? AND ${guard} RETURNING movie_id`).bind(id,genre,id,imdbId));
      for (const genre of [...desired].filter(g => !existing.has(g)))
        statements.push(this.db.prepare(`INSERT INTO movie_genres(movie_id,genre) SELECT ?,? WHERE ${guard} ON CONFLICT(movie_id,genre) DO NOTHING RETURNING movie_id`).bind(id,genre,id,imdbId));
    }
    if (await new TitleRepository(this.db).supported()) {
      const title=providerTitleStatement(this.db,id,'omdb',metadata.title,{provider:'imdb',external_id:imdbId},new Date().toISOString());
      if (title) statements.push(title);
      statements.push(canonicalTitleStatement(this.db,id,{provider:'imdb',external_id:imdbId}));
    }
    // Each write is identity-guarded inside the atomic batch. The final read detects a
    // reassignment between preflight and execution without writing an identity marker.
    const ownership = this.db.prepare("SELECT movie_id FROM movie_external_ids WHERE provider='imdb' AND external_id=?").bind(imdbId);
    if (!statements.length) {
      if ((await ownership.first<{movie_id:string}>())?.movie_id !== id)
        throw new ApiError(409,'IDENTITY_CONFLICT','Stored IMDb identity changed. Refresh before retrying.');
      return false;
    }
    const result = await this.db.batch([...statements,ownership]);
    if ((result[result.length-1].results[0] as {movie_id:string} | undefined)?.movie_id !== id)
      throw new ApiError(409,'IDENTITY_CONFLICT','Stored IMDb identity changed. Refresh before retrying.');
    return result.slice(0,-1).some(r => r.results.length > 0);
  }

  async enrichMetadata(id: string, tmdbId: string, m: ProviderMovie, attachment?: {import_source: string; source_refs: string[]}, captureScores = false, intent?: 'populate' | 'refresh') {
    await this.assertMovie(id);
    if (intent) {
      const current=(await new (await import('./catalog-repository')).CatalogRepository(this.db,this.capabilities).movieDetails([id]))[0];
      m={...m};
      for (const field of ['original_title','year','release_date','runtime','overview','director'] as const) {
        if (m[field] == null || intent==='populate' && current[field] != null && !(typeof current[field]==='string' && !current[field].trim())) Object.assign(m,{[field]:current[field]});
      }
      if (!m.genres.length || intent==='populate' && current.genres.length) m.genres=current.genres;
      if (intent==='populate') m.assets=m.assets.filter(a=>!current.assets.some(old=>old.provider==='tmdb' && old.asset_type===a.asset_type));
    }
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
    const statements = this.metadataStatements(id,m,captureScores,await this.capabilities.hasDirector(),await new TitleRepository(this.db).supported());
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
    await new ProviderEvidenceRepository(this.db).save(id,'collections',m.collection);
    if (m.enrichment) return this.cacheEnrichment(id,m.enrichment);
  }

  // Internal batch builder: callers must validate identity/ownership before executing.
  // Also used inside the local canonical-merge transaction, from the same details response.
  metadataStatements(id: string, m: ProviderMovie, captureScores = false,director = true,titleAuthority = true): D1PreparedStatement[] {
    const imdb = m.external_ids.find(e => e.provider === 'imdb');
    const statements = [this.db.prepare(`UPDATE movies SET ${titleAuthority ? '' : 'title=?,'}original_title=?,year=?,release_date=?,runtime=?,overview=?,${director ? 'director=?,' : ''}tmdb_metadata_checked_at=?,tmdb_artwork_checked_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(...(titleAuthority ? [] : [m.title]),m.original_title,m.year,m.release_date,m.runtime,m.overview,...(director ? [m.director ?? null] : []),m.fetched_at,m.fetched_at,id)];
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
    if (titleAuthority) {
      const identity=m.external_ids.find(e=>e.provider==='tmdb');
      if (identity) {
        const title=providerTitleStatement(this.db,id,'tmdb',m.title,identity,m.fetched_at);
        if (title) statements.push(title);
        statements.push(canonicalTitleStatement(this.db,id));
      }
    }
    return statements;
  }
}
