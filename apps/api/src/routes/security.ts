/**
 * /v1/security/* — 2FA, audit viewer, KVKK export/forget.
 *
 * Tüm endpoint'ler requireAuth (local-auth tabanlı).
 */
import bcrypt from 'bcryptjs';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  authAccounts,
  auditLog,
  authSessions,
  getDb,
  organizations,
  passwordResetTokens,
  paymentTransactions,
  payableItems,
  persons,
  companies,
  tenants,
  userOrganizationRoles,
  userTenantOverrides,
  users,
} from '@sayman/db';
import { env } from '../config/env';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { revokeAllSessionsForAccount } from '../lib/local-auth';
import {
  buildOtpAuthUrl,
  buildQrDataUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from '../lib/totp';
import { requireAuth } from '../middleware/auth';

const BCRYPT_COST = env.NODE_ENV === 'production' ? 12 : 10;

export const securityRouter = Router();

// --- 2FA --------------------------------------------------------------------

/** Sadece local auth user'lar 2FA kullanabilir (Supabase tarafı kendi yönetir) */
function getLocalAccountId(req: { authUser?: { auth_account_id?: string | null } }): string {
  const id = req.authUser?.auth_account_id;
  if (!id) {
    throw new HttpError(
      400,
      '2FA yalnız local auth hesaplarında kullanılır. Önce şifrenizi yeniden belirleyin (forgot-password) → local hesaba geçin.',
      'LOCAL_ONLY',
    );
  }
  return id;
}

securityRouter.post('/security/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const accountId = getLocalAccountId(req);
    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, accountId));
    if (!account) throw new HttpError(404, 'Account bulunamadı');
    if (account.totp_enabled) {
      throw new HttpError(409, '2FA zaten aktif. Önce disable edin.', 'ALREADY_ENABLED');
    }

    const secret = generateTotpSecret();
    const otpauth = buildOtpAuthUrl(account.email, secret);
    const qr_data_url = await buildQrDataUrl(otpauth);

    // Henüz enabled değil — secret'ı sakla (verify'da enabled olacak)
    await db
      .update(authAccounts)
      .set({ totp_secret: secret, updated_at: new Date() })
      .where(eq(authAccounts.id, accountId));

    res.json({ secret, otpauth_url: otpauth, qr_data_url });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/security/2fa/verify', requireAuth, async (req, res, next) => {
  try {
    const accountId = getLocalAccountId(req);
    const body = z.object({ code: z.string().min(6).max(8) }).parse(req.body);
    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, accountId));
    if (!account?.totp_secret) {
      throw new HttpError(400, 'Önce /2fa/setup çağırın', 'NO_SECRET');
    }
    if (!verifyTotpCode(account.totp_secret, body.code)) {
      throw new HttpError(401, 'TOTP kodu geçersiz', 'INVALID_TOTP');
    }

    // Recovery codes üret (plain'i return, hash'i DB'ye)
    const plainCodes = generateRecoveryCodes(10);
    const hashedCodes = plainCodes.map((c) => hashRecoveryCode(c));

    await db
      .update(authAccounts)
      .set({
        totp_enabled: true,
        totp_enabled_at: new Date(),
        totp_recovery_codes: hashedCodes,
        updated_at: new Date(),
      })
      .where(eq(authAccounts.id, accountId));

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: account.email,
      action: 'auth.2fa_enabled',
    });

    res.json({
      ok: true,
      recovery_codes: plainCodes,
      message: 'Bu kodları güvenli bir yerde sakla — bir daha gösterilmeyecek.',
    });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/security/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const accountId = getLocalAccountId(req);
    const body = z.object({ password: z.string().min(1) }).parse(req.body);
    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, accountId));
    if (!account) throw new HttpError(404, 'Account bulunamadı');

    // Password recheck — güvenlik kapısı
    const ok = await bcrypt.compare(body.password, account.password_hash);
    if (!ok) throw new HttpError(401, 'Şifre hatalı', 'INVALID_PASSWORD');

    await db
      .update(authAccounts)
      .set({
        totp_enabled: false,
        totp_secret: null,
        totp_enabled_at: null,
        totp_recovery_codes: [],
        updated_at: new Date(),
      })
      .where(eq(authAccounts.id, accountId));

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: account.email,
      action: 'auth.2fa_disabled',
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

securityRouter.get('/security/2fa/status', requireAuth, async (req, res, next) => {
  try {
    const accountId = req.authUser?.auth_account_id;
    if (!accountId) {
      res.json({ enabled: false, enabled_at: null, recovery_codes_left: 0, supabase_user: true });
      return;
    }
    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, accountId));
    if (!account) throw new HttpError(404, 'Account bulunamadı');
    res.json({
      enabled: account.totp_enabled,
      enabled_at: account.totp_enabled_at,
      recovery_codes_left: account.totp_recovery_codes.length,
    });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/security/2fa/recovery-codes/regenerate', requireAuth, async (req, res, next) => {
  try {
    const accountId = getLocalAccountId(req);
    const db = getDb();
    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.id, accountId));
    if (!account?.totp_enabled) {
      throw new HttpError(400, '2FA aktif değil', 'NOT_ENABLED');
    }
    const plain = generateRecoveryCodes(10);
    const hashed = plain.map((c) => hashRecoveryCode(c));
    await db
      .update(authAccounts)
      .set({ totp_recovery_codes: hashed, updated_at: new Date() })
      .where(eq(authAccounts.id, accountId));
    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: account.email,
      action: 'auth.recovery_codes_regenerated',
    });
    res.json({ ok: true, recovery_codes: plain });
  } catch (err) {
    next(err);
  }
});

// --- Audit log viewer (admin) -----------------------------------------------

/** Bir kayıt için tüm audit eventleri (kim, ne yaptı, ne değişti) */
securityRouter.get(
  '/security/audit/record',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const target_table = String(req.query.target_table ?? '').trim();
      const target_id = String(req.query.target_id ?? '').trim();
      if (!target_table || !target_id) {
        throw new HttpError(400, 'target_table ve target_id zorunlu', 'BAD_REQ');
      }
      const db = getDb();
      const rows = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.organization_id, req.activeOrgId!),
            eq(auditLog.target_table, target_table),
            eq(auditLog.target_id, target_id),
          ),
        )
        .orderBy(desc(auditLog.created_at))
        .limit(200);
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);

securityRouter.get('/security/audit', requireAuth, requireOrg, async (req, res, next) => {
  try {
    // Role check: sadece super_admin + yonetici görür
    const role = req.effectiveRole ?? '';
    if (!['super_admin', 'yonetici'].includes(role)) {
      throw new HttpError(403, 'Audit log için yetkin yok', 'FORBIDDEN');
    }

    const action = (req.query['action'] as string | undefined)?.trim();
    const limit = Math.min(Number(req.query['limit'] ?? 100), 500);
    const db = getDb();

    const where = action
      ? sql`${auditLog.organization_id} = ${req.activeOrgId} AND ${auditLog.module} = ${action.split('.')[0]}`
      : eq(auditLog.organization_id, req.activeOrgId!);

    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.created_at))
      .limit(limit);

    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// --- KVKK export + forget ---------------------------------------------------

securityRouter.get('/security/kvkk/export', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const role = req.effectiveRole ?? '';
    if (!['super_admin', 'yonetici'].includes(role)) {
      throw new HttpError(403, 'KVKK export yalnız yöneticiler için', 'FORBIDDEN');
    }
    const db = getDb();
    const orgId = req.activeOrgId!;

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const tenantRows = await db.select().from(tenants).where(eq(tenants.organization_id, orgId));
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        full_name: users.full_name,
        username: users.username,
        phone: users.phone,
        is_active: users.is_active,
        is_pending: users.is_pending,
        created_at: users.created_at,
      })
      .from(users)
      .innerJoin(userOrganizationRoles, eq(userOrganizationRoles.user_id, users.id))
      .where(eq(userOrganizationRoles.organization_id, orgId));

    const orgRoles = await db
      .select()
      .from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.organization_id, orgId));

    const tenantOverrides = await db
      .select()
      .from(userTenantOverrides)
      .innerJoin(tenants, eq(tenants.id, userTenantOverrides.tenant_id))
      .where(eq(tenants.organization_id, orgId));

    const personRows = await db.select().from(persons).where(eq(persons.organization_id, orgId));
    const companyRows = await db.select().from(companies).where(eq(companies.organization_id, orgId));

    const tenantIds = tenantRows.map((t) => t.id);
    const payables = tenantIds.length
      ? await db
          .select()
          .from(payableItems)
          .where(sql`${payableItems.tenant_id} IN ${tenantIds}`)
      : [];
    const payments = tenantIds.length
      ? await db
          .select()
          .from(paymentTransactions)
          .where(sql`${paymentTransactions.tenant_id} IN ${tenantIds}`)
      : [];

    const auditRows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organization_id, orgId))
      .orderBy(desc(auditLog.created_at))
      .limit(1000);

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: req.authUser?.email,
      action: 'security.kvkk_export',
    });

    res.json({
      exported_at: new Date().toISOString(),
      organization: org,
      tenants: tenantRows,
      users: userRows, // password_hash, totp_secret, jti, ip HARİÇ
      user_organization_roles: orgRoles,
      user_tenant_overrides: tenantOverrides.map((r) => r.user_tenant_overrides),
      persons: personRows,
      companies: companyRows,
      payables,
      payment_transactions: payments,
      audit_log: auditRows.map((r) => ({ ...r, ip_address: null })), // IP anonimleştir
    });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/security/kvkk/forget', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const role = req.effectiveRole ?? '';
    if (role !== 'super_admin') {
      throw new HttpError(403, 'KVKK silme yalnız super_admin için', 'FORBIDDEN');
    }
    const body = z
      .object({
        user_id: z.string().uuid(),
        confirm: z.literal('SILEMEZ_GERI_ALINAMAZ'),
      })
      .parse(req.body);

    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.id, body.user_id));
    if (!u) throw new HttpError(404, 'User bulunamadı');

    // Self-delete koruması
    if (u.id === req.authUserId) {
      throw new HttpError(400, 'Kendinizi silemezsiniz', 'SELF_DELETE');
    }

    const randomEmail = `silinmis-${u.id.slice(0, 8)}@anonim.local`;
    const anonName = 'Silinmiş kullanıcı';

    await db.transaction(async (tx) => {
      // 1. public.users anonimleştir
      await tx
        .update(users)
        .set({
          email: randomEmail,
          full_name: anonName,
          username: null,
          phone: null,
          telegram_chat_id: null,
          avatar_url: null,
          is_active: false,
          updated_at: new Date(),
        })
        .where(eq(users.id, u.id));

      // 2. auth_accounts (varsa) anonimleştir
      if (u.auth_account_id) {
        await tx
          .update(authAccounts)
          .set({
            email: randomEmail,
            full_name: anonName,
            password_hash: '$2a$10$KVKK_FORGOTTEN_NO_LOGIN_POSSIBLE_AAAAAAAAAAAAAAA',
            totp_secret: null,
            totp_enabled: false,
            totp_recovery_codes: [],
            updated_at: new Date(),
          })
          .where(eq(authAccounts.id, u.auth_account_id));

        // Tüm session'ları iptal
        await tx
          .update(authSessions)
          .set({ revoked_at: new Date() })
          .where(eq(authSessions.account_id, u.auth_account_id));

        // Password reset token'ları temizle
        await tx
          .delete(passwordResetTokens)
          .where(eq(passwordResetTokens.account_id, u.auth_account_id));
      }

      // 3. audit_log içindeki bu user'a ait kayıtların actor_id'sini null'a çek (silmeyiz, redact'leriz)
      await tx
        .update(auditLog)
        .set({ after_data: sql`'{"redacted": true}'::jsonb` })
        .where(eq(auditLog.actor_id, u.id));
    });

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: req.authUser?.email,
      action: 'security.kvkk_forget',
      target_type: 'users',
      target_id: u.id,
    });

    res.json({ ok: true, anonymized_email: randomEmail });
  } catch (err) {
    next(err);
  }
});
