/**
 * Supabase JWT auth middleware — Damga pattern'i (sade hâli, API key yok).
 *
 * Authorization: Bearer <supabase_jwt>  →  req.authUser + req.authUserId set
 *
 * Lokal dev'de SUPABASE_* env'leri yoksa middleware 503 döner — bu beklenen
 * davranış (auth deneyen test'ler için). Production'da Supabase yapılandırması
 * zorunlu.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { getDb, users, type User } from '@sayman/db';
import { env, isConfigured } from '../config/env';

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: User;
    authUserId?: string;
  }
}

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

/**
 * Token'ı parse et, Supabase'e doğrula, public.users'tan profili al.
 * Token yoksa veya geçersizse 401 fırlatır.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      const err = new Error('Authorization header eksik') as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      const err = new Error('Geçersiz token') as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.auth_user_id, data.user.id));
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
 * Auth opsiyonel — token varsa parse eder, yoksa anonim olarak devam eder.
 * Public endpoint'lerde "kullanıcı kim?" bilgisini opsiyonel olarak istemek için.
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token || !isConfigured.supabase) {
    next();
    return;
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      next();
      return;
    }
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.auth_user_id, data.user.id));
    if (u && u.is_active) {
      req.authUser = u;
      req.authUserId = u.id;
    }
    next();
  } catch {
    // Sessizce geç — opsiyonel auth'ta hata fırlatmıyoruz
    next();
  }
};
