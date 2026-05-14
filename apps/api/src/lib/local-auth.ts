/**
 * Local auth — Supabase yerine kendi JWT + auth_sessions iptal mekanizması.
 *
 * Sign-in:
 *   1. Bcrypt password check
 *   2. (Opsiyonel) TOTP verify
 *   3. signLocalJwt → auth_sessions satırı (jti) + JWT döner
 *
 * Verify:
 *   1. JWT imzasını doğrula
 *   2. auth_sessions'da jti'yi bul + revoked_at IS NULL kontrolü
 *   3. last_seen_at update (best-effort)
 *
 * Logout / revoke:
 *   revokeJti(jti) → auth_sessions.revoked_at = now()
 */
import crypto from 'node:crypto';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { getDb, authSessions } from '@sayman/db';
import { env } from '../config/env';
import { logger } from '../config/logger';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 gün

interface SignInput {
  id: string;
  email: string;
  ttlSeconds?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface VerifyResult {
  ok: boolean;
  user?: { id: string; email: string };
  jti?: string;
  reason?: 'invalid' | 'expired' | 'revoked';
}

/**
 * JWT üret + auth_sessions satırı oluştur.
 */
export async function signLocalJwt(input: SignInput): Promise<string> {
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  const payload = {
    sub: input.id,
    email: input.email,
    iat: now,
    exp,
    jti,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256' });

  await getDb().insert(authSessions).values({
    account_id: input.id,
    jti,
    issued_at: new Date(now * 1000),
    expires_at: new Date(exp * 1000),
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  return token;
}

/**
 * JWT'yi doğrula + DB session check.
 * DB'ye hit eder; revoke kontrolü için zorunlu.
 */
export async function verifyLocalJwt(token: string): Promise<VerifyResult> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }

  const jti = payload.jti;
  if (!jti || typeof jti !== 'string') return { ok: false, reason: 'invalid' };
  if (!payload.sub || !payload.email) return { ok: false, reason: 'invalid' };

  const db = getDb();
  const [session] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.jti, jti), isNull(authSessions.revoked_at)));

  if (!session) return { ok: false, reason: 'revoked' };
  if (session.expires_at.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Best-effort last_seen update
  db.update(authSessions)
    .set({ last_seen_at: new Date() })
    .where(eq(authSessions.id, session.id))
    .catch((err) => logger.debug({ err }, 'last_seen update fail (best-effort)'));

  return {
    ok: true,
    user: { id: String(payload.sub), email: String(payload.email) },
    jti,
  };
}

/**
 * Sadece imza doğrula, DB hit yok.
 * Logout endpoint'i kendi jti'sini revoke etmek için kullanır (DB session
 * silinmiş bile olsa logout call'u 200 dönmeli).
 */
export function verifyLocalJwtOffline(token: string): VerifyResult {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (!payload.jti || !payload.sub || !payload.email) return { ok: false, reason: 'invalid' };
    return {
      ok: true,
      user: { id: String(payload.sub), email: String(payload.email) },
      jti: String(payload.jti),
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export async function revokeJti(jti: string): Promise<void> {
  await getDb()
    .update(authSessions)
    .set({ revoked_at: new Date() })
    .where(and(eq(authSessions.jti, jti), isNull(authSessions.revoked_at)));
}

export async function revokeAllSessionsForAccount(
  accountId: string,
  exceptJti?: string,
): Promise<number> {
  const where = exceptJti
    ? and(
        eq(authSessions.account_id, accountId),
        isNull(authSessions.revoked_at),
        ne(authSessions.jti, exceptJti),
      )
    : and(eq(authSessions.account_id, accountId), isNull(authSessions.revoked_at));

  const result = await getDb()
    .update(authSessions)
    .set({ revoked_at: new Date() })
    .where(where)
    .returning({ id: authSessions.id });

  return result.length;
}

/**
 * Eski expired session'ları temizle (cron veya periodic cleanup).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await getDb()
    .delete(authSessions)
    .where(sql`${authSessions.expires_at} < now() - interval '30 days'`)
    .returning({ id: authSessions.id });
  return result.length;
}
