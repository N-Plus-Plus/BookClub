import type { Viewer } from '../../shared/types';

const viewerColumns = 'm.id,m.display_name';
export class AuthRepository {
  constructor(private db: D1Database) {}
  async bindIdentity(sub: string,email: string,now: string): Promise<Viewer | null> {
    // Single guarded UPDATE: bound sub takes precedence; no read/write binding race.
    // NOT EXISTS prevents an email candidate winning when this sub is already bound.
    const bound = await this.db.prepare(`UPDATE member_auth SET
      google_sub=?,bound_at=COALESCE(bound_at,?),last_login_at=?
      WHERE member_id IN (SELECT id FROM members WHERE active=1)
      AND (google_sub=? OR (google_sub IS NULL AND authorized_email=?
        AND NOT EXISTS (SELECT 1 FROM member_auth WHERE google_sub=?)))
      RETURNING member_id`).bind(sub,now,now,sub,email,sub).first<{member_id: string}>();
    if (!bound) return null;
    return this.db.prepare(`SELECT ${viewerColumns} FROM members m WHERE m.id=? AND m.active=1`).bind(bound.member_id).first<Viewer>();
  }
  async createSession(hash: string,memberId: string,createdAt: string,expiresAt: string) {
    await this.db.prepare('INSERT INTO auth_sessions(token_hash,member_id,created_at,expires_at) VALUES(?,?,?,?)').bind(hash,memberId,createdAt,expiresAt).run();
  }
  async sessionViewer(hash: string,now: string): Promise<Viewer | null> {
    return this.db.prepare(`SELECT ${viewerColumns} FROM auth_sessions s
      JOIN member_auth a ON a.member_id=s.member_id JOIN members m ON m.id=s.member_id
      WHERE s.token_hash=? AND s.expires_at>? AND m.active=1 AND a.google_sub IS NOT NULL`).bind(hash,now).first<Viewer>();
  }
  async revoke(hash: string) {
    await this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(hash).run();
  }
}
