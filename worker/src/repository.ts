import type { Asset, Catalog, ExternalId, Member, Movie, Score, SeenAnswer, Session, SessionInput, ManualMovieInput } from '../../shared/types';
import { rankMovie } from '../../shared/ranking';
import type { ProviderMovie } from './providers/types';
import { ApiError } from './http';

type MovieRow = Pick<Movie, 'id' | 'title' | 'original_title' | 'year' | 'release_date' | 'runtime' | 'overview'>;
type SessionRow = Omit<Session,'movies'>;
type WithMovie<T> = T & { movie_id: string };

export class Repository {
  constructor(private db: D1Database) {}
  async catalog(): Promise<Catalog> {
    // D1 batch gives one consistent transactional read for the derived rankings.
    const result = await this.db.batch([
      this.db.prepare('SELECT id,display_name,sort_order,active FROM members ORDER BY sort_order,id'),
      this.db.prepare('SELECT id,title,original_title,year,release_date,runtime,overview FROM movies ORDER BY title,id'),
      this.db.prepare('SELECT movie_id,provider,asset_type,reference,width,height,preferred FROM movie_assets ORDER BY preferred DESC,id'),
      this.db.prepare('SELECT movie_id,provider,external_id FROM movie_external_ids'),
      this.db.prepare('SELECT movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at FROM source_scores ORDER BY fetched_at,id'),
      this.db.prepare('SELECT movie_id,member_id,seen,updated_at FROM seen_states'),
      this.db.prepare('SELECT movie_id FROM classics'),
      this.db.prepare('SELECT movie_id,genre FROM movie_genres ORDER BY genre'),
      this.db.prepare('SELECT id,event_date,title,host_member_id,legacy_cycle_label,notes FROM sessions ORDER BY event_date DESC,created_at DESC,id'),
      this.db.prepare('SELECT session_id,movie_id,position FROM session_movies ORDER BY position'),
    ]);
    const rows = <T>(i: number) => result[i].results as T[];
    const members = rows<Member>(0);
    const movies = rows<MovieRow>(1).map(m => {
      const scores = rows<WithMovie<Score>>(4).filter(s => s.movie_id === m.id);
      const seen = rows<WithMovie<SeenAnswer>>(5).filter(s => s.movie_id === m.id);
      const classic = rows<{movie_id: string}>(6).some(c => c.movie_id === m.id);
      return { ...m, scores, seen, classic, ranking: classic ? rankMovie(scores,seen,members) : null,
        genres: rows<{movie_id: string; genre: string}>(7).filter(g => g.movie_id === m.id).map(g => g.genre),
        assets: rows<WithMovie<Asset>>(2).filter(a => a.movie_id === m.id),
        external_ids: rows<WithMovie<ExternalId>>(3).filter(e => e.movie_id === m.id) };
    });
    const movieMap = new Map(movies.map(m => [m.id,m]));
    const sessions = rows<SessionRow>(8).map(s => ({ ...s,
      movies: rows<{session_id: string; movie_id: string; position: number}>(9)
        .filter(j => j.session_id === s.id).map(j => movieMap.get(j.movie_id)!).filter(Boolean) }));
    return { members, movies, sessions };
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
    if (existingId && !await this.db.prepare('SELECT id FROM sessions WHERE id=?').bind(existingId).first()) throw new ApiError(404,'NOT_FOUND','Event not found.');
    for (const id of new Set(input.movie_ids)) await this.assertMovie(id);
    if (input.host_member_id && !await this.db.prepare('SELECT id FROM members WHERE id=? AND active=1').bind(input.host_member_id).first()) throw new ApiError(422,'INVALID_HOST','Choose an active member as host.');
    const id = existingId ?? crypto.randomUUID();
    const fields = [input.event_date,input.title || null,input.host_member_id || null,input.legacy_cycle_label || null,input.notes || null];
    const statements = existingId ? [
      this.db.prepare("UPDATE sessions SET event_date=?,title=?,host_member_id=?,legacy_cycle_label=?,notes=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(...fields,id),
      this.db.prepare('DELETE FROM session_movies WHERE session_id=?').bind(id),
    ] : [this.db.prepare('INSERT INTO sessions(id,event_date,title,host_member_id,legacy_cycle_label,notes) VALUES(?,?,?,?,?,?)').bind(id,...fields)];
    statements.push(...input.movie_ids.map((movieId,i) => this.db.prepare('INSERT INTO session_movies(session_id,movie_id,position) VALUES(?,?,?)').bind(id,movieId,i+1)));
    await this.db.batch(statements); // Event and ordered joins commit atomically.
    return id;
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
  async importMovie(m: ProviderMovie): Promise<string> {
    // Persist the entire provider-neutral snapshot atomically; IDs enforce import safety.
    const id = crypto.randomUUID();
    const statements = [this.db.prepare('INSERT INTO movies(id,title,original_title,year,release_date,runtime,overview) VALUES(?,?,?,?,?,?,?)')
      .bind(id,m.title,m.original_title,m.year,m.release_date,m.runtime,m.overview)];
    statements.push(...m.external_ids.map(e => this.db.prepare('INSERT INTO movie_external_ids(movie_id,provider,external_id) VALUES(?,?,?)').bind(id,e.provider,e.external_id)));
    statements.push(...m.genres.map(g => this.db.prepare('INSERT INTO movie_genres(movie_id,genre) VALUES(?,?)').bind(id,g)));
    statements.push(...m.assets.map(a => this.db.prepare('INSERT INTO movie_assets(id,movie_id,provider,asset_type,reference,width,height,preferred,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,a.provider,a.asset_type,a.reference,a.width,a.height,a.preferred,m.fetched_at)));
    statements.push(...m.scores.map(s => this.db.prepare('INSERT INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),id,s.provider,s.metric,s.raw_value,s.raw_scale,s.normalized_value,s.vote_count,s.fetched_at)));
    await this.db.batch(statements);
    return id;
  }
}
