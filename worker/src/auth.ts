import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Viewer } from '../../shared/types';
import { ApiError, localBypass, type Env } from './http';
import { AuthRepository } from './auth-repository';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export interface GoogleIdentity { sub: string; email: string; email_verified: boolean }
export type GoogleVerifier = (credential: string, audience: string) => Promise<GoogleIdentity>;
const invalidCredential = () => new ApiError(401,'INVALID_GOOGLE_CREDENTIAL','Google sign-in could not be verified. Please sign in again.');
export function createGoogleVerifier(keys: JWTVerifyGetKey = googleKeys): GoogleVerifier { return async (credential,audience) => {
  try {
    const { payload } = await jwtVerify(credential,keys,{
      audience, issuer: ['https://accounts.google.com','accounts.google.com'], algorithms: ['RS256'],
      requiredClaims: ['exp','sub','email','email_verified'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email || payload.email_verified !== true) throw invalidCredential();
    return { sub: payload.sub,email: payload.email,email_verified: true };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWTExpired ||
        error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWSInvalid ||
        error instanceof errors.JWTInvalid || error instanceof errors.JOSEAlgNotAllowed ||
        error instanceof errors.JWKSNoMatchingKey) throw invalidCredential();
    // Network/JWK infrastructure failures become the router's safe generic 500.
    throw error;
  }
}; }
export const verifyGoogle = createGoogleVerifier();
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,'0')).join('');
}
export interface AuthContext { viewer: Viewer | null; tokenHash: string | null }
export async function authenticate(request: Request,env: Env): Promise<AuthContext> {
  if (localBypass(env)) return { viewer: null,tokenHash: null };
  const match = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/i);
  if (!match) throw new ApiError(401,'SESSION_REQUIRED','Sign in to BookClub to continue.');
  const tokenHash = await hashToken(match[1]);
  const viewer = await new AuthRepository(env.DB).sessionViewer(tokenHash,new Date().toISOString());
  if (!viewer) throw new ApiError(401,'SESSION_EXPIRED','Your BookClub session has expired or been revoked. Please sign in again.');
  return { viewer,tokenHash };
}
export async function login(credential: unknown,env: Env,verify: GoogleVerifier = verifyGoogle) {
  if (typeof credential !== 'string' || !credential || credential.length > 16384) throw invalidCredential();
  if (!env.GOOGLE_CLIENT_ID?.trim()) throw new ApiError(503,'AUTH_NOT_CONFIGURED','Google sign-in is not configured. Contact the club administrator.');
  const identity = await verify(credential,env.GOOGLE_CLIENT_ID.trim());
  if (!identity.sub || !identity.email || identity.email_verified !== true) throw invalidCredential();
  const repo = new AuthRepository(env.DB), now = new Date();
  const viewer = await repo.bindIdentity(identity.sub,identity.email.trim().toLowerCase(),now.toISOString());
  if (!viewer) throw new ApiError(403,'ACCOUNT_NOT_AUTHORIZED','This Google account is not authorised for BookClub. Use your club account or contact the club administrator.');
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),b => b.toString(16).padStart(2,'0')).join('');
  const expiresAt = new Date(now.getTime()+90*24*60*60*1000).toISOString();
  await repo.createSession(await hashToken(token),viewer.id,now.toISOString(),expiresAt);
  return { token,viewer,expiresAt };
}
