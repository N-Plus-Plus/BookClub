import { ApiError } from './http';
import { validImdbSql, validTmdbSql } from './metadata-sql';
import { usableTitle } from '../../shared/titles';
// One SQL resolver shared by every persistence path and cached reconciliation.
// Provider evidence is admitted only by identity-guarded repository writes.
export function canonicalTitleStatement(db: D1Database, movieId: string, identity?: {provider:string;external_id:string}) {
  return db.prepare(`WITH winner AS (
    SELECT trim(title) AS title,provider AS source FROM movie_provider_metadata
    WHERE movie_id=? AND provider IN ('omdb','tmdb','mdblist')
      AND typeof(title)='text' AND length(trim(title))>0 AND trim(title)<>'N/A'
    ORDER BY CASE provider WHEN 'omdb' THEN 1 WHEN 'tmdb' THEN 2 ELSE 3 END LIMIT 1
  ), resolved AS (
    SELECT coalesce((SELECT title FROM winner),title) AS title,
      coalesce((SELECT source FROM winner),CASE WHEN import_source='legacy-spreadsheet' THEN 'legacy-spreadsheet' ELSE 'manual' END) AS source
    FROM movies WHERE id=?
  ) UPDATE movies SET title=(SELECT title FROM resolved),title_source=(SELECT source FROM resolved),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=? ${identity ? 'AND EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?)' : ''} AND (title IS NOT (SELECT title FROM resolved) OR title_source IS NOT (SELECT source FROM resolved)) RETURNING id`)
    .bind(movieId,movieId,movieId,...(identity ? [movieId,identity.provider,identity.external_id] : []));
}
export function providerTitleStatement(db: D1Database, movieId: string, provider: string, title: unknown, identity: {provider:string;external_id:string}, at: string) {
  const value=usableTitle(title);
  const validIdentity=identity.provider==='imdb' ? /^tt\d{7,10}$/.test(identity.external_id)
    : identity.provider==='tmdb' && /^[1-9]\d{0,9}$/.test(identity.external_id);
  const allowed=provider==='omdb' ? identity.provider==='imdb' : provider==='tmdb' ? identity.provider==='tmdb' : provider==='mdblist';
  if (!value || !validIdentity || !allowed) return null;
  return db.prepare(`INSERT INTO movie_provider_metadata(movie_id,provider,title,fetched_at)
    SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM movie_external_ids WHERE movie_id=? AND provider=? AND external_id=?)
    ON CONFLICT(movie_id,provider) DO UPDATE SET title=excluded.title,fetched_at=excluded.fetched_at
    WHERE movie_provider_metadata.title IS NOT excluded.title RETURNING movie_id`)
    .bind(movieId,provider,value,at,movieId,identity.provider,identity.external_id);
}
export class TitleRepository {
  constructor(private db: D1Database) {}
  async supported() {
    return (await this.db.prepare('PRAGMA table_info(movies)').all<{name:string}>()).results.some(c=>c.name==='title_source');
  }
  async requireSupported() {
    if (!await this.supported()) throw new ApiError(503,'SCHEMA_REQUIRED','Canonical title maintenance requires migration 0017.');
  }
  async reconcileCanonicalTitle(movieId: string) {
    await this.requireSupported();
    return this.db.batch([canonicalTitleStatement(this.db,movieId)]);
  }
  async status() {
    await this.requireSupported();
    const results=await this.db.batch([
      this.db.prepare('SELECT title_source AS source,count(*) AS count FROM movies GROUP BY title_source'),
      this.db.prepare(`SELECT count(*) AS total,
      coalesce(sum(EXISTS(SELECT 1 FROM movie_external_ids e WHERE e.movie_id=m.id AND e.provider='imdb' AND (${validImdbSql('e.external_id')})) AND NOT EXISTS(SELECT 1 FROM movie_provider_metadata p WHERE p.movie_id=m.id AND p.provider='omdb' AND length(trim(p.title))>0 AND trim(p.title)<>'N/A')),0) AS missingOmdb,
      coalesce(sum(EXISTS(SELECT 1 FROM movie_external_ids e WHERE e.movie_id=m.id AND e.provider='tmdb' AND (${validTmdbSql('e.external_id')})) AND NOT EXISTS(SELECT 1 FROM movie_provider_metadata p WHERE p.movie_id=m.id AND p.provider='tmdb' AND length(trim(p.title))>0 AND trim(p.title)<>'N/A')),0) AS missingTmdb
      FROM movies m`),
    ]);
    const sources=results[0].results as {source:string;count:number}[],missing=results[1].results[0] as {total:number;missingOmdb:number;missingTmdb:number};
    return {...missing,sources:Object.fromEntries(['omdb','tmdb','mdblist','manual','legacy-spreadsheet'].map(s=>[s,sources.find(r=>r.source===s)?.count ?? 0]))};
  }
  async reconcileBatch(after: string | null) {
    await this.requireSupported();
    const rows=(await this.db.prepare('SELECT id FROM movies WHERE (? IS NULL OR id>?) ORDER BY id LIMIT 50').bind(after,after).all<{id:string}>()).results;
    const result=rows.length ? await this.db.batch(rows.map(r=>canonicalTitleStatement(this.db,r.id))) : [];
    return {processed:rows.length,changed:result.filter(r=>r.results.length).length,next:rows.length===50 ? rows.at(-1)!.id : null};
  }
}
