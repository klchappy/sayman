/**
 * Dual auth middleware — Supabase JWT (legacy) + Local JWT (yeni) destekler.
 *
 * Token detection:
 *   - HS256 + jti claim   → Local JWT (verifyLocalJwt + auth_sessions check)
 *   - Diğer (ES256/RS256) → Supabase JWT (auth/v1/admin/users)
 *
 * public.users lookup:
 *   - Local: users.auth_account_id = auth_accounts.id ile match
 *   - Supabase: users.auth_user_id = supabase auth.users.id ile match (legacy)
 *
 * Production migration sırasında BOTH dolu olabilir; biri öncelikli.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eq, or } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { getDb, users, type User } from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { verifyLocalJwt } from '../lib/local-auth';

let _supabase: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!isConfigured.supabase) {
    const err = new Error('Supabase yapılandırılmamış') as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

/** Token'ın hangi tipte olduğunu tespit et (decode etmeden header). */
function detectTokenKind(token: string): 'local' | 'supabase' | 'unknown' {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') return 'unknown';

    const alg = decoded.header?.alg;
    const payload = decoded.payload as jwt.JwtPayload | null;

    if (alg === 'HS256' && payload?.jti) return 'local';
    // Supabase: ES256 veya RS256 + iss=supabase.co
    if (alg === 'ES256' || alg === 'RS256') return 'supabase';
    if (payload?.iss && String(payload.iss).includes('supabase.co')) return 'supabase';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Local JWT'den account_id ile public.users lookup */
async function resolveLocalUser(accountId: string): Promise<User | null> {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.auth_account_id, accountId));
  return u ?? null;
}

/** Supabase user.id ile public.users lookup */
async function resolveSupabaseUser(authUserId: string): Promise<User | null> {
  const db = getDb();
  const [u] = await db.select().from(users).where(eq(users.auth_user_id, authUserId));
  return u ?? null;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      const err = new Error('Authorization header eksik') as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const kind = detectTokenKind(token);

    if (kind === 'local') {
      const res = await verifyLocalJwt(token);
      if (!res.ok || !res.user) {
        const err = new Error('Geçersiz/iptal edilmiş token') as Error & { status?: number };
        err.status = 401;
        throw err;
      }
      const u = await resolveLocalUser(res.user.id);
      if (!u) {
        const err = new Error('Kullanıcı profili bulunamadı (auth_account)') as Error & {
          status?: number;
        };
        err.status = 404;
        throw err;
      }
      if (!u.is_active) {
        const err = new Error('Kullanıcı pasif') as Error & { status?: number };
        err.status = 403;
        throw err;
      }
      req.authUser = u;
      req.authUserId = u.id;
      next();
      return;
    }

    // Supabase (legacy / production user)
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      const err = new Error('Geçersiz token') as Error & { status?: number };
      err.status = 401;
      throw err;
    }
    const u = await resolveSupabaseUser(data.user.id);
    if (!u) {
      const err = new Error('Kullanıcı profili bulunamadı (public.users)') as Error & {
        status?: number;
      };
      err.status = 404;
      throw err;
    }
    if (!u.is_active) {
      const err = new Error('Kullanıcı pasif') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    req.authUser = u;
    req.authUserId = u.id;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * optionalAuth — token varsa parse eder, yoksa anonim devam.
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    next();
    return;
  }
  try {
    const kind = detectTokenKind(token);
    if (kind === 'local') {
      const res = await verifyLocalJwt(token);
      if (res.ok && res.user) {
        const u = await resolveLocalUser(res.user.id);
        if (u && u.is_active) {
          req.authUser = u;
          req.authUserId = u.id;
        }
      }
    } else if (isConfigured.supabase) {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const u = await resolveSupabaseUser(data.user.id);
        if (u && u.is_active) {
          req.authUser = u;
          req.authUserId = u.id;
        }
      }
    }
    next();
  } catch {
    // Opsiyonel auth — hata fırlatma
    next();
  }
};
