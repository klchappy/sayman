/**
 * /v1/auth/local/* — Supabase yerine kendi auth flow'umuz.
 *
 * Endpoint'ler:
 *   POST /v1/auth/local/sign-in       (TOTP-aware)
 *   POST /v1/auth/local/sign-up-org   (yeni org + 7 default department + JWT)
 *   POST /v1/auth/forgot-password
 *   POST /v1/auth/reset-password/verify
 *   POST /v1/auth/reset-password
 *   POST /v1/auth/logout              (her iki token tipi destekli)
 *   GET  /v1/auth/sessions
 *   POST /v1/auth/sessions/:id/revoke
 *   POST /v1/auth/sessions/revoke-others
 */
import bcrypt from 'bcryptjs';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  authAccounts,
  authSessions,
  departments,
  DEFAULT_DEPARTMENTS,
  getDb,
  organizations,
  userOrganizationRoles,
  users,
} from '@sayman/db';
import { env } from '../config/env';
import { HttpError } from '../lib/helpers';
import { auditFromRequest } from '../lib/audit';
import { consumeRateLimit } from '../lib/rate-limit';
import {
  revokeAllSessionsForAccount,
  revokeJti,
  signLocalJwt,
  verifyLocalJwtOffline,
} from '../lib/local-auth';
import {
  consumeResetToken,
  dispatchForgotEmail,
  dispatchForgotPhone,
  verifyResetToken,
} from '../lib/password-reset';
import { hashRecoveryCode, verifyTotpCode } from '../lib/totp';
import { requireAuth } from '../middleware/auth';

const BCRYPT_COST = env.NODE_ENV === 'production' ? 12 : 10;

function getIp(req: { headers: { [k: string]: unknown }; ip?: string }): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? null;
  return req.ip ?? null;
}
function getUa(req: { headers: { [k: string]: unknown } }): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export const authLocalRouter = Router();

// --- POST /v1/auth/local/sign-in --------------------------------------------

const signInSchema = z.object({
  identifier: z.string().min(2),
  password: z.string().min(1),
  totp_code: z.string().optional(),
  recovery_code: z.string().optional(),
});

authLocalRouter.post('/auth/local/sign-in', async (req, res, next) => {
  try {
    const body = signInSchema.parse(req.body);
    const identifier = body.identifier.toLowerCase().trim();

    // Rate limit: identifier (5/dk) + ip (20/dk)
    consumeRateLimit({ identifier: `signin:id:${identifier}`, limit: 5, window_seconds: 60 });
    const ip = getIp(req);
    if (ip) consumeRateLimit({ identifier: `signin:ip:${ip}`, limit: 20, window_seconds: 60 });

    const db = getDb();
    const [account] = await db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.email, identifier));

    // Enumeration koruması: account yoksa bile timing/yapı aynı
    if (!account) {
      await bcrypt.compare(body.password, '$2a$10$dummy.hash.to.prevent.timing.attack.AAAAAAAAA');
      throw new HttpError(401, 'E-posta veya şifre hatalı', 'INVALID_CREDENTIALS');
    }

    const passwordOk = await bcrypt.compare(body.password, account.password_hash);
    if (!passwordOk) {
      throw new HttpError(401, 'E-posta veya şifre hatalı', 'INVALID_CREDENTIALS');
    }

    // 2FA challenge
    if (account.totp_enabled && account.totp_secret) {
      if (body.recovery_code) {
        const codeHash = hashRecoveryCode(body.recovery_code);
        if (!account.totp_recovery_codes.includes(codeHash)) {
          throw new HttpError(401, 'Recovery kodu geçersiz', 'INVALID_RECOVERY');
        }
        // Tek kullanımlık: kullanılan kodu sil
        const remaining = account.totp_recovery_codes.filter((c) => c !== codeHash);
        await db
          .update(authAccounts)
          .set({ totp_recovery_codes: remaining, updated_at: new Date() })
          .where(eq(authAccounts.id, account.id));
      } else if (body.totp_code) {
        if (!verifyTotpCode(account.totp_secret, body.totp_code)) {
          throw new HttpError(401, 'TOTP kodu geçersiz', 'INVALID_TOTP');
        }
      } else {
        res.status(401).json({
          error: 'totp_required',
          challenge: 'totp',
          message: 'İki faktörlü kod gerekli',
        });
        return;
      }
    }

    const token = await signLocalJwt({
      id: account.id,
      email: account.email,
      ipAddress: ip,
      userAgent: getUa(req),
    });

    // public.users last_login_at update (opsiyonel — yoksa atlanır)
    db
      .update(users)
      .set({ last_login_at: new Date() })
      .where(eq(users.auth_account_id, account.id))
      .catch(() => undefined);

    await auditFromRequest(req, {
      actor_user_id: account.id,
      actor_email: account.email,
      action: 'auth.login',
      details: { method: account.totp_enabled ? 'password+totp' : 'password' },
    });

    res.json({ access_token: token, token_type: 'Bearer', expires_in: 7 * 24 * 3600 });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/auth/local/sign-up-org ----------------------------------------

const signUpOrgSchema = z.object({
  account_type: z.enum(['company', 'individual']).default('company'),
  org_name: z.string().min(2).max(200),
  full_name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalı')
    .regex(/[A-Z]/, 'En az 1 büyük harf')
    .regex(/[a-z]/, 'En az 1 küçük harf')
    .regex(/[0-9]/, 'En az 1 rakam'),
  accept_terms: z.literal(true),
  accept_kvkk: z.literal(true),
});

async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  const baseSlug = base
    .toLowerCase()
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!baseSlug) return `org-${Date.now().toString(36)}`;

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}-${i}`;
    const [exists] = await db.select().from(organizations).where(eq(organizations.slug, candidate));
    if (!exists) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

authLocalRouter.post('/auth/local/sign-up-org', async (req, res, next) => {
  try {
    const body = signUpOrgSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    consumeRateLimit({ identifier: `signup:ip:${getIp(req) ?? '0'}`, limit: 5, window_seconds: 300 });

    const db = getDb();

    // Email zaten var mı?
    const [existing] = await db.select().from(authAccounts).where(eq(authAccounts.email, email));
    if (existing) {
      throw new HttpError(409, 'Bu e-posta zaten kayıtlı', 'EMAIL_TAKEN');
    }

    const password_hash = await bcrypt.hash(body.password, BCRYPT_COST);
    const orgName = body.account_type === 'individual' ? `${body.full_name} (Bireysel)` : body.org_name;
    const slug = await uniqueSlug(orgName);

    const result = await db.transaction(async (tx) => {
      const [account] = await tx
        .insert(authAccounts)
        .values({ email, full_name: body.full_name, password_hash })
        .returning();

      const [org] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          slug,
          plan: 'trial',
          contact_email: email,
        })
        .returning();

      if (!account || !org) throw new HttpError(500, 'Org/account oluşturulamadı');

      const [user] = await tx
        .insert(users)
        .values({
          auth_account_id: account.id,
          email,
          full_name: body.full_name,
        })
        .returning();

      if (!user) throw new HttpError(500, 'User oluşturulamadı');

      await tx.insert(userOrganizationRoles).values({
        user_id: user.id,
        organization_id: org.id,
        role: 'super_admin',
      });

      // 7 default departman
      await tx.insert(departments).values(
        DEFAULT_DEPARTMENTS.map((d) => ({
          organization_id: org.id,
          name: d.name,
          slug: d.slug,
          color: d.color,
          is_default: d.is_default,
        })),
      );

      return { account, org, user };
    });

    const token = await signLocalJwt({
      id: result.account.id,
      email: result.account.email,
      ipAddress: getIp(req),
      userAgent: getUa(req),
    });

    await auditFromRequest(req, {
      organization_id: result.org.id,
      actor_user_id: result.account.id,
      actor_email: email,
      action: 'auth.sign_up_org',
      target_type: 'organizations',
      target_id: result.org.id,
      details: { org_name: orgName, slug, account_type: body.account_type },
    });

    res.status(201).json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 3600,
      organization: { id: result.org.id, slug: result.org.slug, name: result.org.name },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/auth/forgot-password ------------------------------------------

const forgotSchema = z.object({
  identifier: z.string().min(2).optional(),
  email: z.string().email().optional(),
  method: z.enum(['email', 'sms', 'whatsapp']).default('email'),
});

authLocalRouter.post('/auth/forgot-password', async (req, res, next) => {
  try {
    const body = forgotSchema.parse(req.body);
    const identifier = (body.identifier ?? body.email ?? '').toLowerCase().trim();
    if (!identifier) throw new HttpError(400, 'identifier veya email gerekli', 'MISSING_ID');

    consumeRateLimit({ identifier: `forgot:id:${identifier}`, limit: 3, window_seconds: 3600 });
    const ip = getIp(req);
    if (ip) consumeRateLimit({ identifier: `forgot:ip:${ip}`, limit: 10, window_seconds: 3600 });

    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.email, identifier));

    // Enumeration koruması: account yok bile aynı response
    if (!account) {
      res.json({
        ok: true,
        delivered: 'link_generated',
        message: 'Eğer kayıtlı bir hesap varsa link gönderildi.',
      });
      return;
    }

    if (body.method === 'email') {
      const result = await dispatchForgotEmail({
        account,
        ip,
        user_agent: getUa(req),
      });
      await auditFromRequest(req, {
        actor_user_id: account.id,
        actor_email: account.email,
        action: 'auth.password_reset_requested',
        details: { method: 'email' },
      });
      res.json({
        ok: true,
        delivered: result.delivered,
        action_link: result.action_link, // gateway yoksa caller (UI) gösterir
      });
      return;
    }

    const result = await dispatchForgotPhone({ account, method: body.method });
    await auditFromRequest(req, {
      actor_user_id: account.id,
      actor_email: account.email,
      action: 'auth.password_reset_requested',
      details: { method: body.method },
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/auth/reset-password/verify ------------------------------------

authLocalRouter.post('/auth/reset-password/verify', async (req, res, next) => {
  try {
    const body = z.object({ token: z.string().min(10) }).parse(req.body);
    const result = await verifyResetToken(body.token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/auth/reset-password -------------------------------------------

const resetSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

authLocalRouter.post('/auth/reset-password', async (req, res, next) => {
  try {
    const body = resetSchema.parse(req.body);
    const ip = getIp(req);
    consumeRateLimit({ identifier: `reset:ip:${ip ?? '0'}`, limit: 5, window_seconds: 3600 });

    const result = await consumeResetToken({ token: body.token, new_password: body.password });
    if (!result.ok || !result.account_id || !result.email) {
      throw new HttpError(400, `Token geçersiz (${result.reason ?? 'unknown'})`, 'INVALID_TOKEN');
    }

    // Otomatik login
    const token = await signLocalJwt({
      id: result.account_id,
      email: result.email,
      ipAddress: ip,
      userAgent: getUa(req),
    });

    await auditFromRequest(req, {
      actor_user_id: result.account_id,
      actor_email: result.email,
      action: 'auth.password_reset_completed',
    });

    // Diğer aktif session'ları iptal (güvenlik)
    await revokeAllSessionsForAccount(result.account_id, undefined);

    res.json({
      ok: true,
      access_token: token,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 3600,
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /v1/auth/logout ---------------------------------------------------

authLocalRouter.post('/auth/logout', async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      res.json({ ok: true });
      return;
    }

    // Local token ise jti revoke (DB session silinmiş bile olsa 200 dön)
    const offline = verifyLocalJwtOffline(token);
    if (offline.ok && offline.jti) {
      await revokeJti(offline.jti).catch(() => undefined);
      await auditFromRequest(req, {
        actor_user_id: offline.user?.id,
        actor_email: offline.user?.email,
        action: 'auth.logout',
      });
    }
    // Supabase ise client-side signOut yapar; backend'de bir şey yapmıyoruz
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- GET /v1/auth/sessions --------------------------------------------------

authLocalRouter.get('/auth/sessions', requireAuth, async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (!user.auth_account_id) {
      // Supabase user'lar için sessions yok (Supabase tarafı yönetiyor)
      res.json({ data: [], note: 'Supabase auth — sessions managed by provider' });
      return;
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.account_id, user.auth_account_id))
      .orderBy(asc(authSessions.revoked_at), sql`${authSessions.last_seen_at} DESC NULLS LAST`)
      .limit(50);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

authLocalRouter.post('/auth/sessions/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (!user.auth_account_id) {
      throw new HttpError(400, 'Sadece local auth hesapları desteklenir', 'LOCAL_ONLY');
    }
    const db = getDb();
    const [session] = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, String(req.params.id ?? '')),
          eq(authSessions.account_id, user.auth_account_id),
        ),
      );
    if (!session) throw new HttpError(404, 'Session bulunamadı');
    if (!session.revoked_at) {
      await db
        .update(authSessions)
        .set({ revoked_at: new Date() })
        .where(eq(authSessions.id, session.id));
    }
    await auditFromRequest(req, {
      actor_user_id: user.id,
      actor_email: user.email,
      action: 'auth.session_revoked',
      target_type: 'auth_sessions',
      target_id: session.id,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authLocalRouter.post('/auth/sessions/revoke-others', requireAuth, async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (!user.auth_account_id) {
      throw new HttpError(400, 'Sadece local auth hesapları desteklenir', 'LOCAL_ONLY');
    }
    // Mevcut request'in jti'sini çek (token'dan)
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const offline = verifyLocalJwtOffline(token);
    const myJti = offline.ok ? offline.jti : undefined;
    const count = await revokeAllSessionsForAccount(user.auth_account_id, myJti);
    await auditFromRequest(req, {
      actor_user_id: user.id,
      actor_email: user.email,
      action: 'auth.sessions_revoked_others',
      details: { count },
    });
    res.json({ ok: true, count });
  } catch (err) {
    next(err);
  }
});
