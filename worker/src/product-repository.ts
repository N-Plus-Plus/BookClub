import type { Member, BuilderInput, BuilderSet, HistoryAudit, Rotation, SessionInput, Viewer } from '../../shared/types';
import { ApiError } from './http';
import { effectiveMember, swapTargets } from '../../shared/rotation';

const conflict = (message: string) => new ApiError(409,'STATE_CONFLICT',message);
const missing = () => new ApiError(404,'NOT_FOUND','Record not found.');
export function requireViewer(viewer: Viewer | null): Viewer {
  if (!viewer) throw new ApiError(401,'VIEWER_REQUIRED','Sign in as a member to use this personal action. Local bypass has no personal viewer.');
  return viewer;
}
export function requireAdmin(viewer: Viewer | null): Viewer {
  const actor = requireViewer(viewer);
  if (actor.role !== 'admin') throw new ApiError(403,'ADMIN_REQUIRED','An administrator is required for this action.');
  return actor;
}
export class ProductRepository {
  constructor(private db: D1Database) {}
  private async batch(statements: D1PreparedStatement[]) {
    try { await this.db.batch(statements); }
    catch (error) {
      if (/SWAP_REQUIRED/.test(String(error))) throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','This host change requires the pending database upgrade. Try again after deployment.');
      if (/active_cycle_slot|sessions.cycle_id, sessions.cycle_slot/.test(String(error))) throw conflict('This turn already has an active History event in the selected cycle. Choose another turn or review History.');
      if (/BUILDER_CONFLICT|TURN_CONFLICT|HISTORY_CONFLICT|completed_turn_once|completed_turn_version|sessions.builder_id|club_rotation.id|FOREIGN KEY constraint failed/.test(String(error)))
        throw conflict('The record or current turn changed. Refresh before retrying.');
      throw error;
    }
  }
  private audit(actor: Viewer | null, session: string | null, action: string, changes: unknown) {
    return this.db.prepare('INSERT INTO history_audit(id,actor_member_id,session_id,action,changes_json) VALUES(?,?,?,?,?)')
      .bind(crypto.randomUUID(),actor?.id ?? null,session,action,JSON.stringify(changes));
  }
  async availableAvatars() {
    const {results} = await this.db.prepare('SELECT avatar FROM members WHERE avatar IS NOT NULL').all<{avatar: number}>();
    const used = new Set(results.map(r => r.avatar));
    return Array.from({length: 20},(_,i) => i).filter(i => !used.has(i));
  }
  async claimAvatar(viewer: Viewer, avatar: number): Promise<Viewer> {
    let row: Viewer | null;
    try { row = await this.db.prepare(`UPDATE members SET avatar=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=? AND active=1 AND avatar IS NULL RETURNING id,display_name,sort_order,avatar,role`).bind(avatar,viewer.id).first<Viewer>(); }
    catch (error) {
      if (/UNIQUE constraint failed: members.avatar/.test(String(error))) throw conflict('That avatar was just chosen. Choose another available avatar.');
      throw error;
    }
    if (!row) throw conflict('You have already chosen an avatar. Refresh to continue.');
    return row;
  }
  async rotation(): Promise<Rotation | null> {
    const row = await this.db.prepare('SELECT * FROM club_rotation WHERE id=1').first<Omit<Rotation,'human_order'> & {human_order?:string}>();
    return row ? {...row,human_order:JSON.parse(row.human_order ?? '{}') as Record<string,string>} : null;
  }
  async swapRotation(actor: Viewer, input: {target_member_id: string; version: number}) {
    const columns = await this.db.prepare('PRAGMA table_info(club_rotation)').all<{name:string}>();
    if (!columns.results.some(column => column.name === 'human_order'))
      throw new ApiError(503,'SCHEMA_UPGRADE_REQUIRED','Turn swaps require the pending database upgrade. Try again after deployment.');
    const before = await this.rotation();
    if (!before || before.version !== input.version) throw conflict('Current turn changed. Reload before swapping.');
    const members = (await this.db.prepare('SELECT * FROM members').all<Member>()).results;
    const sessions = (await this.db.prepare('SELECT cycle_id,cycle_slot,host_member_id,deleted_at FROM sessions WHERE cycle_id=? AND deleted_at IS NULL').bind(before.cycle_id).all<{cycle_id:string;cycle_slot:number;host_member_id:string|null;deleted_at:null}>()).results;
    const current = effectiveMember(members,before);
    const target = swapTargets(members,before,sessions).find(target => target.member.id === input.target_member_id);
    if (!current || !target) throw new ApiError(422,'INVALID_SWAP','Choose an active member with a future, uncompleted turn and no Event this cycle.');
    const order = {...before.human_order,[before.nominal_slot]:target.member.id,[target.slot]:current.id};
    await this.batch([
      this.db.prepare("UPDATE club_rotation SET human_order=?,version=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1").bind(JSON.stringify(order),input.version+1),
      this.audit(actor,null,'rotation',{before,after:{...before,human_order:order,version:input.version+1},swap:{current_member_id:current.id,target_member_id:target.member.id,target_slot:target.slot}}),
    ]);
    return this.rotation();
  }
  async builders(owner: string): Promise<BuilderSet[]> {
    const results = await this.db.batch([
      this.db.prepare('SELECT * FROM builder_sets WHERE owner_member_id=? ORDER BY updated_at DESC,id').bind(owner),
      this.db.prepare('SELECT bm.* FROM builder_movies bm JOIN builder_sets b ON b.id=bm.builder_id WHERE b.owner_member_id=? ORDER BY bm.position').bind(owner),
    ]);
    const films = results[1].results as {builder_id: string; movie_id: string}[];
    return (results[0].results as Omit<BuilderSet,'movie_ids'>[]).map(b => ({...b,movie_ids: films.filter(f => f.builder_id === b.id).map(f => f.movie_id)}));
  }
  async builder(owner: string, id: string) {
    const row = (await this.builders(owner)).find(b => b.id === id);
    if (!row) throw missing(); return row;
  }
  private async validateMovies(ids: string[]) {
    for (const id of new Set(ids)) if (!await this.db.prepare('SELECT id FROM movies WHERE id=?').bind(id).first()) throw new ApiError(422,'INVALID_MOVIE','Choose saved films.');
  }
  async saveBuilder(owner: string, input: BuilderInput, id: string = crypto.randomUUID(), existing = false) {
    if (existing) {
      const before = await this.builder(owner,id);
      if (input.revision !== before.revision) throw conflict('This Builder changed. Refresh before saving.');
    }
    await this.validateMovies(input.movie_ids);
    const statements = existing ? [this.db.prepare(`UPDATE builder_sets SET title=?,notes=?,revision=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND owner_member_id=?`)
      .bind(input.title || null,input.notes || null,input.revision!+1,id,owner),this.db.prepare('DELETE FROM builder_movies WHERE builder_id=? AND EXISTS(SELECT 1 FROM builder_sets WHERE id=? AND owner_member_id=?)').bind(id,id,owner)]
      : [this.db.prepare('INSERT INTO builder_sets(id,owner_member_id,title,notes) VALUES(?,?,?,?)').bind(id,owner,input.title || null,input.notes || null)];
    statements.push(...input.movie_ids.map((movie,i) => this.db.prepare('INSERT INTO builder_movies(builder_id,movie_id,position) VALUES(?,?,?)').bind(id,movie,i+1)));
    await this.batch(statements); return this.builder(owner,id);
  }
  async deleteBuilder(owner: string, id: string, revision: number) {
    const before = await this.builder(owner,id);
    if (before.revision !== revision) throw conflict('This Builder changed. Refresh before deleting.');
    const removed = await this.db.prepare('DELETE FROM builder_sets WHERE id=? AND owner_member_id=? AND revision=? RETURNING id').bind(id,owner,revision).first();
    if (!removed) throw conflict('This Builder changed. Refresh before deleting.');
  }
  async saveSession(input: SessionInput, actor: Viewer | null, existingId?: string, builder?: BuilderSet) {
    const before = existingId ? await this.db.prepare('SELECT * FROM sessions WHERE id=? AND deleted_at IS NULL').bind(existingId).first<Record<string,unknown>>() : null;
    if (existingId && !before) throw missing();
    if (before) {
      const viewer = requireViewer(actor);
      if (viewer.role !== 'admin' && (before.kind !== 'hosted' || before.host_member_id !== viewer.id)) throw new ApiError(403,'FORBIDDEN','You may edit only events you hosted.');
    }
    if (existingId && input.complete_turn) throw new ApiError(422,'INVALID_COMPLETION','An existing History event cannot complete a new turn.');
    if (before) {
      input = {...input,kind:before.kind as SessionInput['kind'],host_member_id:before.host_member_id as string | null};
    } else if (!builder) {
      const current = await this.rotation();
      if (!current) throw new ApiError(409,'CURRENT_TURN_UNAVAILABLE','The current turn is unavailable. Ask an administrator to initialise rotation.');
      const members = (await this.db.prepare('SELECT * FROM members').all<Member>()).results;
      const member = effectiveMember(members,current);
      if (current.nominal_slot !== 5 && !member) throw new ApiError(422,'CURRENT_HOST_UNAVAILABLE','The current turn has no active member. Ask an administrator to correct the rotation roster.');
      input = {...input,kind:current.nominal_slot === 5 ? 'classics' : 'hosted',host_member_id:member?.id ?? null};
    }
    await this.validateMovies(input.movie_ids);
    if (!before && input.host_member_id && !await this.db.prepare('SELECT id FROM members WHERE id=? AND active=1').bind(input.host_member_id).first()) throw new ApiError(422,'INVALID_HOST','The event host is unavailable.');
    let cycleId = input.cycle_id ?? null, slot = input.cycle_slot ?? null;
    const kind = input.kind ?? 'hosted', precision = input.date_precision ?? 'exact';
    const statements: D1PreparedStatement[] = [];
    let turn: Rotation | null = null;
    if (input.complete_turn) {
      turn = await this.rotation();
      if (!turn || input.turn_version !== turn.version) throw conflict('Current turn is unavailable or changed. Refresh before publishing.');
      if (slot !== turn.nominal_slot || cycleId !== turn.cycle_id) throw conflict('Complete the current turn in its current cycle.');
      if (precision !== 'exact') throw new ApiError(422,'INVALID_COMPLETION','Current events require their actual event date.');
      if (turn.nominal_slot === 1) {
        if (input.new_cycle) throw new ApiError(422,'INVALID_CYCLE','This turn starts a new cycle automatically. Remove the separate new-cycle selection.');
        input = {...input,new_cycle: {rough_date: input.event_date}};
      }
    }
    if (slot === 5 ? kind !== 'classics' : slot !== null && kind !== 'hosted') throw new ApiError(422,'INVALID_SLOT','Classics week requires a Classics event; a member’s turn requires a hosted event.');
    if (kind === 'classics' && input.host_member_id) throw new ApiError(422,'INVALID_HOST','Classics is hostless.');
    if (!before && kind === 'hosted' && slot !== null && slot <= 4) {
      const nominal = await this.db.prepare('SELECT id FROM members WHERE sort_order=?').bind(slot).first<{id: string}>();
      if (!input.host_member_id || !nominal) throw new ApiError(422,'INVALID_HOST','This turn’s member is unavailable. Ask an administrator to check the roster.');
    }
    if (cycleId && slot !== null && await this.db.prepare('SELECT id FROM sessions WHERE cycle_id=? AND cycle_slot=? AND deleted_at IS NULL AND id<>?').bind(cycleId,slot,existingId ?? '').first())
      throw conflict('This turn already has an active History event in the selected cycle. Choose another turn or review History.');
    if (input.new_cycle) {
      if (slot !== 1 || kind !== 'hosted' || precision !== 'exact' || input.new_cycle.rough_date !== input.event_date) throw new ApiError(422,'INVALID_ANCHOR','A new cycle begins with Sean’s turn and its exact event date as the cycle anchor.');
      cycleId = crypto.randomUUID();
      statements.push(this.db.prepare('INSERT INTO cycles(id,ordinal,rough_date,title) SELECT ?,COALESCE(?,COALESCE(MAX(ordinal),0)+1),?,? FROM cycles').bind(cycleId,input.new_cycle.ordinal ?? null,input.event_date,input.new_cycle.title || null));
    } else if (cycleId) {
      const cycle = await this.db.prepare('SELECT rough_date FROM cycles WHERE id=?').bind(cycleId).first<{rough_date: string}>();
      if (!cycle) throw new ApiError(422,'INVALID_CYCLE','Choose an existing cycle.');
      if (slot === 1 && precision === 'exact' && cycle.rough_date !== input.event_date) {
        if (!existingId || before?.cycle_slot !== 1 || before?.cycle_id !== cycleId || !input.correct_anchor) throw new ApiError(422,'INVALID_ANCHOR','Sean’s turn establishes the cycle anchor. Confirm an anchor correction when editing its event date, or choose the matching cycle.');
        if (await this.db.prepare('SELECT id FROM sessions WHERE cycle_id=? AND cycle_slot=1 AND id<>? AND deleted_at IS NULL').bind(cycleId,existingId).first()) throw conflict('This cycle has multiple records for Sean’s turn. Ask an administrator to resolve them before correcting its anchor.');
        statements.push(this.db.prepare("UPDATE cycles SET rough_date=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(input.event_date,cycleId));
        const references = (await this.db.prepare("SELECT id,event_date FROM sessions WHERE cycle_id=? AND date_precision='cycle_rough' AND deleted_at IS NULL AND id<>?").bind(cycleId,existingId).all<{id: string; event_date: string}>()).results;
        for (const reference of references) statements.push(
          this.db.prepare("UPDATE sessions SET event_date=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(input.event_date,reference.id),
          this.audit(actor,reference.id,'edit',{before: {event_date: reference.event_date},after: {event_date: input.event_date},cycle_anchor_correction: true,rotation_unchanged: true}));
      }
      if (precision === 'cycle_rough' && cycle.rough_date !== input.event_date) throw new ApiError(422,'INVALID_DATE_PRECISION','Use the cycle anchor as the reference date when the actual date is unknown.');
    }
    const id = existingId ?? crypto.randomUUID();
    const fields = [input.event_date,input.host_member_id || null,input.legacy_cycle_label || null,cycleId,kind,precision,slot];
    if (existingId) {
      statements.push(this.db.prepare(`UPDATE sessions SET event_date=?,host_member_id=?,legacy_cycle_label=?,cycle_id=?,kind=?,date_precision=?,cycle_slot=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).bind(...fields,id),
        this.db.prepare('DELETE FROM session_movies WHERE session_id=?').bind(id));
    } else statements.push(this.db.prepare('INSERT INTO sessions(id,event_date,host_member_id,legacy_cycle_label,cycle_id,kind,date_precision,cycle_slot,planned_at,published_by,builder_id,builder_revision,completed_turn_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,...fields,builder?.created_at ?? null,actor?.id ?? null,builder?.id ?? null,builder?.revision ?? null,turn?.version ?? null));
    statements.push(...input.movie_ids.map((movie,i) => this.db.prepare('INSERT INTO session_movies(session_id,movie_id,position) VALUES(?,?,?)').bind(id,movie,i+1)));
    if (turn && slot === 5) for (const movie of new Set(input.movie_ids)) statements.push(this.db.prepare(`INSERT INTO seen_states(movie_id,member_id,seen) SELECT ?,id,1 FROM members WHERE active=1
      ON CONFLICT(movie_id,member_id) DO UPDATE SET seen=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(movie));
    const oldFilms = before ? (await this.db.prepare('SELECT movie_id,position FROM session_movies WHERE session_id=? ORDER BY position').bind(id).all()).results : null;
    statements.push(this.audit(actor,id,existingId ? 'edit' : 'create',{before: before ? {...before,films: oldFilms} : null,after: {...input,cycle_id: cycleId},planned_at: builder?.created_at ?? before?.planned_at ?? null,turn_before: turn,rotation_unchanged: Boolean(existingId),requires_rotation_review: Boolean(existingId && before?.completed_turn_version != null)}));
    await this.batch(statements); return id;
  }
  async publishBuilder(actor: Viewer, id: string, revision: number, input: SessionInput) {
    const builder = await this.builder(actor.id,id);
    if (builder.revision !== revision) throw conflict('Builder changed. Refresh before publishing.');
    if (!builder.movie_ids.length) throw new ApiError(422,'EMPTY_BUILDER','Add at least one film.');
    return this.saveSession({...input,movie_ids: builder.movie_ids,host_member_id: input.kind === 'classics' ? null : actor.id},actor,undefined,builder);
  }
  async deleteSession(actor: Viewer | null, id: string) {
    requireAdmin(actor);
    const before = await this.db.prepare('SELECT * FROM sessions WHERE id=? AND deleted_at IS NULL').bind(id).first();
    if (!before) throw missing();
    await this.batch([this.db.prepare(`UPDATE sessions SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),deleted_by=? WHERE id=?`).bind(actor?.id ?? null,id),
      this.audit(actor,id,'delete',{before,rotation_unchanged: true,requires_rotation_review: (before as {completed_turn_version?: number | null}).completed_turn_version != null})]);
  }
  async restoreSession(actor: Viewer, id: string) {
    const before = await this.db.prepare('SELECT * FROM sessions WHERE id=? AND deleted_at IS NOT NULL').bind(id).first<{event_date: string; date_precision: string; cycle_id: string | null; completed_turn_version: number | null}>();
    if (!before) throw missing();
    const cycle = before.date_precision === 'cycle_rough' && before.cycle_id ? await this.db.prepare('SELECT rough_date FROM cycles WHERE id=?').bind(before.cycle_id).first<{rough_date: string}>() : null;
    const date = cycle?.rough_date ?? before.event_date;
    await this.batch([this.db.prepare('UPDATE sessions SET deleted_at=NULL,deleted_by=NULL,event_date=? WHERE id=?').bind(date,id),this.audit(actor,id,'restore',{before,after: {event_date: date},rotation_unchanged: true,requires_rotation_review: before.completed_turn_version != null})]);
  }
  async auditTrail(id: string): Promise<HistoryAudit[]> {
    if (!await this.db.prepare('SELECT id FROM sessions WHERE id=?').bind(id).first()) throw missing();
    return (await this.db.prepare('SELECT * FROM history_audit WHERE session_id=? ORDER BY occurred_at,id').bind(id).all<HistoryAudit>()).results;
  }
}
