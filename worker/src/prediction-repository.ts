import type { AiPrediction } from '../../shared/types';
import { ApiError } from './http';

export class PredictionRepository {
  constructor(private db:D1Database) {}
  async requireSchema() {
    if (!await this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_predictions'").first()) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','AI predictions require migration 0026.');
  }
  async participant(id:string) {
    const member=await this.db.prepare('SELECT id,display_name FROM members WHERE id=? AND active=1 AND sort_order BETWEEN 1 AND 4').bind(id).first<{id:string;display_name:string}>();
    if (!member) throw new ApiError(422,'INVALID_PARTICIPANT','Choose a human participant.');
    return member;
  }
  async list():Promise<AiPrediction[]> {
    await this.requireSchema();
    return (await this.db.prepare('SELECT p.member_id,p.movie_id FROM ai_predictions p JOIN members m ON m.id=p.member_id WHERE m.active=1 AND m.sort_order BETWEEN 1 AND 4 ORDER BY p.member_id,p.movie_id').all<AiPrediction>()).results;
  }
  async add(memberId:string,movieId:string) {
    await this.requireSchema(); await this.participant(memberId);
    if (!await this.db.prepare('SELECT id FROM movies WHERE id=?').bind(movieId).first()) throw new ApiError(422,'INVALID_MOVIE','Choose a saved catalogue film.');
    try { await this.db.prepare('INSERT INTO ai_predictions(member_id,movie_id) VALUES(?,?) ON CONFLICT(member_id,movie_id) DO NOTHING').bind(memberId,movieId).run(); }
    catch(error) {
      if (String(error).includes('PREDICTION_HISTORY')) throw new ApiError(409,'PREDICTION_HISTORY','This film is already in active History.');
      if (String(error).includes('PREDICTION_MEMBER')) throw new ApiError(422,'INVALID_PARTICIPANT','Choose a human participant.');
      throw error;
    }
    return this.list();
  }
  async remove(memberId:string,movieId:string) {
    await this.requireSchema(); await this.participant(memberId);
    await this.db.prepare('DELETE FROM ai_predictions WHERE member_id=? AND movie_id=?').bind(memberId,movieId).run();
    return this.list();
  }
  async preference(memberId:string) {
    await this.requireSchema();
    return {show_ai:Boolean((await this.db.prepare('SELECT show_ai FROM member_preferences WHERE member_id=?').bind(memberId).first<{show_ai:number}>())?.show_ai)};
  }
  async setPreference(memberId:string,show:boolean) {
    await this.requireSchema();
    await this.db.prepare('INSERT INTO member_preferences(member_id,show_ai) VALUES(?,?) ON CONFLICT(member_id) DO UPDATE SET show_ai=excluded.show_ai').bind(memberId,Number(show)).run();
    return {show_ai:show};
  }
  async exportHistory(memberId:string) {
    const member=await this.participant(memberId);
    // Same cycle/slot order as History's oldest-first presentation, then ungrouped events.
    const rows=(await this.db.prepare(`SELECT m.title,m.year,
      (SELECT external_id FROM movie_external_ids WHERE movie_id=m.id AND provider='imdb') AS imdb,
      (SELECT external_id FROM movie_external_ids WHERE movie_id=m.id AND provider='tmdb') AS tmdb
      FROM sessions s LEFT JOIN cycles c ON c.id=s.cycle_id JOIN session_movies sm ON sm.session_id=s.id JOIN movies m ON m.id=sm.movie_id
      WHERE s.deleted_at IS NULL AND s.kind='hosted' AND s.host_member_id=?
      ORDER BY c.id IS NULL,c.ordinal ASC,c.id DESC,
      CASE WHEN c.id IS NOT NULL THEN coalesce(s.cycle_slot,6) END ASC,
      s.event_date ASC,s.created_at ASC,CASE WHEN c.id IS NOT NULL THEN s.id END ASC,
      CASE WHEN c.id IS NULL THEN s.id END DESC,sm.position ASC`).bind(memberId).all<{title:string;year:number|null;imdb:string|null;tmdb:string|null}>()).results;
    const escape=(value:unknown)=>{const text=value==null?'':String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
    return {filename:`bookclub-${member.display_name.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'') || member.id}-history.txt`,text:'Title,Year,IMDb ID,TMDB ID\r\n'+rows.map(row=>[row.title,row.year,row.imdb,row.tmdb].map(escape).join(',')+'\r\n').join('')};
  }
}
