import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createWorker } from '../worker/src/index';
import { createGoogleVerifier, hashToken, type GoogleIdentity } from '../worker/src/auth';
import { ApiError, type Env } from '../worker/src/http';
import type { AuthLogin } from '../shared/types';

// Actual migrations and repository SQL, with an in-memory SQLite D1 adapter.
let sqlite: DatabaseSync;
let env: Env;
let identity: GoogleIdentity;
let invalid = false;
const worker = createWorker(async () => {
  if (invalid) throw new ApiError(401,'INVALID_GOOGLE_CREDENTIAL','Invalid Google credential.');
  return identity;
});
function prepare(sql: string,values: SQLInputValue[] = []): unknown {
  return {
    bind: (...args: SQLInputValue[]) => prepare(sql,args),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    all: async () => ({results: sqlite.prepare(sql).all(...values)}),
    run: async () => sqlite.prepare(sql).run(...values),
  };
}
const call = (path: string,method = 'GET',token?: string,data?: unknown) => worker.fetch(new Request(`http://api/api/v1${path}`,{
  method,headers: token ? {Authorization: `Bearer ${token}`} : {},
  ...(data === undefined ? {} : {body: JSON.stringify(data)}),
}),env);
const login = async () => {
  const response = await call('/auth/google','POST',undefined,{credential: 'mock-google-credential'});
  return {response,data: (await response.json() as {data: AuthLogin}).data};
};
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const migration of ['0001_foundation.sql','0002_auth.sql','0003_cycles_scores.sql']) sqlite.exec(readFileSync(`worker/migrations/${migration}`,'utf8'));
  sqlite.exec("INSERT INTO members(id,display_name) VALUES('member-test','Test Member'); INSERT INTO member_auth(member_id,authorized_email) VALUES('member-test','member@example.invalid')");
  env = {DB: {prepare,batch: async (statements: {all: () => Promise<unknown>}[]) => Promise.all(statements.map(s => s.all()))} as unknown as D1Database,
    APP_ENV: 'production',LOCAL_WRITE_BYPASS: 'false',GOOGLE_CLIENT_ID: 'test-client',ALLOWED_ORIGINS: 'https://n-plus-plus.github.io'};
  identity = {sub: 'google-test-sub',email: 'Member@Example.Invalid',email_verified: true}; invalid = false;
});
afterEach(() => sqlite.close());
describe('BookClub authentication',() => {
  it('protects production GET and mutations before DB access',async () => {
    env.DB = {} as D1Database;
    for (const [path,method] of [['/catalog','GET'],['/sessions','POST'],['/members','GET'],['/movies/search?q=Moon','GET']]) expect((await call(path,method)).status).toBe(401);
    expect((await call('/health')).status).toBe(200);
  });
  it('binds first login and stores only a hash of a high-entropy token',async () => {
    const {response,data} = await login(); expect(response.status).toBe(200); expect(data.viewer).toEqual({id: 'member-test',display_name: 'Test Member'});
    expect(data.token).toMatch(/^[a-f0-9]{64}$/);
    const row = sqlite.prepare('SELECT * FROM member_auth').get(); expect(row?.google_sub).toBe(identity.sub); expect(row?.bound_at).toBeTruthy();
    const session = sqlite.prepare('SELECT * FROM auth_sessions').get(); expect(session?.token_hash).toBe(await hashToken(data.token)); expect(session?.token_hash).not.toBe(data.token);
    expect(Date.parse(data.expiresAt)-Date.parse(session!.created_at as string)).toBe(90*24*60*60*1000);
    expect((await call('/auth/me','GET',data.token)).status).toBe(200);
    expect((await call('/catalog','GET',data.token)).status).toBe(200);
    expect((await call('/movies','POST',data.token,{title: 'Authenticated test film'})).status).toBe(201);
  });
  it('prefers the bound sub even if the verified email changes',async () => {
    await login(); identity.email = 'changed@example.invalid';
    expect((await login()).response.status).toBe(200);
    expect(sqlite.prepare('SELECT count(*) AS n FROM member_auth').get()?.n).toBe(1);
  });
  it('denies outsiders without creating any account or session',async () => {
    identity.email = 'outsider@example.invalid'; expect((await login()).response.status).toBe(403);
    expect(sqlite.prepare('SELECT count(*) AS n FROM members').get()?.n).toBe(1);
    expect(sqlite.prepare('SELECT count(*) AS n FROM auth_sessions').get()?.n).toBe(0);
    expect(sqlite.prepare('SELECT google_sub FROM member_auth').get()?.google_sub).toBeNull();
  });
  it('does not rebind an email to a different sub',async () => {
    await login(); identity.sub = 'different-sub'; expect((await login()).response.status).toBe(403);
    expect(sqlite.prepare('SELECT google_sub FROM member_auth').get()?.google_sub).toBe('google-test-sub');
  });
  it('does not bind another email row when the sub already belongs to a member',async () => {
    await login();
    sqlite.exec("INSERT INTO members(id,display_name) VALUES('other-member','Other Test'); INSERT INTO member_auth(member_id,authorized_email) VALUES('other-member','other@example.invalid')");
    identity.email = 'other@example.invalid';
    const {response,data} = await login(); expect(response.status).toBe(200); expect(data.viewer.id).toBe('member-test');
    expect(sqlite.prepare("SELECT google_sub FROM member_auth WHERE member_id='other-member'").get()?.google_sub).toBeNull();
  });
  it('the placeholder bootstrap is idempotent and cannot overwrite a binding',async () => {
    const example = readFileSync('scripts/auth/bootstrap-members.example.sql','utf8');
    sqlite.exec(example); sqlite.exec("UPDATE member_auth SET google_sub='preserved-sub' WHERE member_id='club-member-1'"); sqlite.exec(example);
    expect(sqlite.prepare("SELECT count(*) AS n FROM members WHERE id LIKE 'club-member-%'").get()?.n).toBe(4);
    expect(sqlite.prepare("SELECT count(*) AS n FROM member_auth WHERE member_id LIKE 'club-member-%'").get()?.n).toBe(4);
    expect(sqlite.prepare("SELECT google_sub FROM member_auth WHERE member_id='club-member-1'").get()?.google_sub).toBe('preserved-sub');
  });
  it('denies unverified email and invalid or missing credentials',async () => {
    identity.email_verified = false; expect((await login()).response.status).toBe(401);
    identity.email_verified = true; invalid = true; expect((await login()).response.status).toBe(401);
    expect((await call('/auth/google','POST',undefined,{})).status).toBe(401);
  });
  it('denies unknown, expired and revoked sessions',async () => {
    expect((await call('/auth/me','GET','a'.repeat(64))).status).toBe(401);
    const {data} = await login(); sqlite.exec("UPDATE auth_sessions SET expires_at='2000-01-01T00:00:00.000Z'");
    expect((await call('/auth/me','GET',data.token)).status).toBe(401);
    const next = (await login()).data;
    expect((await call('/auth/logout','POST',next.token)).status).toBe(200);
    expect((await call('/auth/me','GET',next.token)).status).toBe(401);
  });
  it('denies deactivated members and removed allow-list rows',async () => {
    const {data} = await login(); sqlite.exec("UPDATE members SET active=0");
    expect((await call('/auth/me','GET',data.token)).status).toBe(401); expect((await login()).response.status).toBe(403);
    sqlite.exec('UPDATE members SET active=1; DELETE FROM member_auth');
    expect((await call('/auth/me','GET',data.token)).status).toBe(401);
  });
  it('retains explicit local bypass without Google',async () => {
    env.APP_ENV = 'local'; env.LOCAL_WRITE_BYPASS = 'true'; delete env.GOOGLE_CLIENT_ID;
    expect((await call('/catalog')).status).toBe(200);
    expect((await call('/movies','POST',undefined,{title: 'Local test film'})).status).toBe(201);
    env.LOCAL_WRITE_BYPASS = 'false'; expect((await call('/catalog')).status).toBe(401);
  });
  it('permits Authorization preflight only for exact allowed origins',async () => {
    for (const origin of ['https://n-plus-plus.github.io','https://untrusted.example']) {
      const response = await worker.fetch(new Request('http://api/api/v1/catalog',{method: 'OPTIONS',headers: {Origin: origin,'Access-Control-Request-Headers': 'Authorization, Content-Type'}}),env);
      const permitted = origin === env.ALLOWED_ORIGINS;
      expect(response.status).toBe(permitted ? 204 : 403);
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(permitted ? 'Content-Type, Authorization' : null);
      expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false);
    }
  });
  it('fails safely when Google is not configured or D1 fails',async () => {
    delete env.GOOGLE_CLIENT_ID; expect((await login()).response.status).toBe(503);
    env.GOOGLE_CLIENT_ID = 'test-client'; env.DB = {} as D1Database;
    const response = await call('/auth/google','POST',undefined,{credential: 'mock'}); expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('TypeError');
  });
});
describe('cryptographic Google verification without network',() => {
  it('validates signature, issuer, audience, expiry and required claims',async () => {
    const {privateKey,publicKey} = await generateKeyPair('RS256');
    const verify = createGoogleVerifier(createLocalJWKSet({keys: [await exportJWK(publicKey)]}));
    const claims = {iss: 'https://accounts.google.com',aud: 'test-client',sub: 'test-sub',email: 'test@example.invalid',email_verified: true,exp: Math.floor(Date.now()/1000)+60};
    const sign = (payload: Record<string,unknown>) => new SignJWT(payload).setProtectedHeader({alg: 'RS256'}).sign(privateKey);
    expect((await verify(await sign(claims),'test-client')).sub).toBe('test-sub');
    expect((await verify(await sign({...claims,iss: 'accounts.google.com'}),'test-client')).sub).toBe('test-sub');
    for (const change of [{aud: 'wrong'},{iss: 'https://evil.example'},{exp: 1},{sub: ''},{email: ''},{email_verified: false},{email_verified: 'true'}]) {
      await expect(verify(await sign({...claims,...change}),'test-client')).rejects.toMatchObject({status: 401});
    }
    const {privateKey: wrongKey} = await generateKeyPair('RS256');
    await expect(verify(await new SignJWT(claims).setProtectedHeader({alg: 'RS256'}).sign(wrongKey),'test-client')).rejects.toMatchObject({status: 401});
    await expect(verify('invalid','test-client')).rejects.toMatchObject({status: 401});
    const {exp: _exp,...noExpiry} = claims;
    await expect(verify(await sign(noExpiry),'test-client')).rejects.toMatchObject({status: 401});
  });
});
