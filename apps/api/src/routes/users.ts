/**
 * /v1/users — organization scope kullanıcı yönetimi.
 *
 *   GET    /v1/users                       → org'daki tüm kullanıcılar + rolleri
 *   POST   /v1/users/invite                → davet (token + e-postada link)
 *   GET    /v1/users/invitations           → bekleyen davetler
 *   POST   /v1/users/invitations/:id/revoke
 *   PATCH  /v1/users/:id/role              → org rolünü değiştir
 *   POST   /v1/users/:id/tenant-override   → tenant-bazlı override ekle/güncelle
 *   DELETE /v1/users/:id                   → org'dan çıkar (role'ü kaldır)
 *
 *   POST   /v1/users/accept-invite         → davet kabul (PUBLIC — auth gerekmez)
 *   GET    /v1/users/invitations/:token/verify (PUBLIC)
 *   GET    /v1/users/me/permissions        → mevcut user'ın permissionlarını döndür
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  ROLE_PERMISSIONS,
  TENANT_OVERRIDE_VALUES,
  roleCan,
  type Role,
} from '@sayman/shared';
import {
  authAccounts,
  getDb,
  organizations,
  tenants,
  userInvitations,
  userOrganizationRoles,
  userTenantOverrides,
  users,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { env } from '../config/env';
import { HttpError, requireOrg } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { signLocalJwt } from '../lib/local-auth';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';

const BCRYPT_COST = env.NODE_ENV === 'production' ? 12 : 10;
const INVITE_TTL_HOURS = 72;

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function getIp(req: { headers: { [k: string]: unknown }; ip?: string }): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? null;
  return req.ip ?? null;
}
function getUa(req: { headers: { [k: string]: unknown } }): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export const usersRouter = Router();

// ---------------------------------------------------------------------------
// GET /v1/users — org'daki tüm kullanıcılar + rolleri
// ---------------------------------------------------------------------------

usersRouter.get(
  '/users',
  requireAuth,
  requireOrg,
  requirePerm('users.read'),
  async (req, res, next) => {
    try {
      const db = getDb();

      const rows = await db
        .select({
          user_id: users.id,
          email: users.email,
          full_name: users.full_name,
          avatar_url: users.avatar_url,
          last_login_at: users.last_login_at,
          role: userOrganizationRoles.role,
          created_at: userOrganizationRoles.created_at,
        })
        .from(userOrganizationRoles)
        .innerJoin(users, eq(users.id, userOrganizationRoles.user_id))
        .where(eq(userOrganizationRoles.organization_id, req.activeOrgId!))
        .orderBy(desc(userOrganizationRoles.created_at));

      // Tenant overrides
      const userIds = rows.map((r) => r.user_id);
      const overrides =
        userIds.length > 0
          ? await db
              .select({
                user_id: userTenantOverrides.user_id,
                tenant_id: userTenantOverrides.tenant_id,
                tenant_slug: tenants.slug,
                tenant_name: tenants.name,
                value: userTenantOverrides.value,
              })
              .from(userTenantOverrides)
              .innerJoin(tenants, eq(tenants.id, userTenantOverrides.tenant_id))
              .where(
                sql`${userTenantOverrides.user_id} = ANY(${userIds}) AND ${tenants.organization_id} = ${req.activeOrgId!}`,
              )
          : [];

      const enriched = rows.map((r) => ({
        ...r,
        role_label: ROLE_LABELS[r.role as Role] ?? r.role,
        overrides: overrides.filter((o) => o.user_id === r.user_id),
      }));

      res.json({ data: enriched, count: enriched.length });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/users/me/permissions — mevcut user'ın izinleri (UI guard için)
// ---------------------------------------------------------------------------

usersRouter.get('/users/me/permissions', requireAuth, requireOrg, async (req, res) => {
  const role = (req.effectiveRole ?? null) as Role | null;
  const set = role ? ROLE_PERMISSIONS[role] : null;
  res.json({
    data: {
      role,
      role_label: role ? ROLE_LABELS[role] : null,
      permissions: set ? [...set] : [],
      all_permissions: [...PERMISSIONS],
    },
  });
});

// ---------------------------------------------------------------------------
// POST /v1/users/invite
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
  tenant_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

usersRouter.post(
  '/users/invite',
  requireAuth,
  requireOrg,
  requirePerm('users.invite'),
  async (req, res, next) => {
    try {
      const body = inviteSchema.parse(req.body);
      const email = body.email.toLowerCase().trim();

      consumeRateLimit({
        identifier: `invite:org:${req.activeOrgId}`,
        limit: 30,
        window_seconds: 3600,
      });

      const db = getDb();

      // Kişi zaten bu org'da üye mi?
      const [existingAcc] = await db.select().from(authAccounts).where(eq(authAccounts.email, email));
      if (existingAcc) {
        const [existingUser] = await db.select().from(users).where(eq(users.auth_account_id, existingAcc.id));
        if (existingUser) {
          const [existingRole] = await db
            .select()
            .from(userOrganizationRoles)
            .where(
              and(
                eq(userOrganizationRoles.user_id, existingUser.id),
                eq(userOrganizationRoles.organization_id, req.activeOrgId!),
              ),
            );
          if (existingRole) {
            throw new HttpError(409, 'Bu kullanıcı zaten organizasyonda üye', 'ALREADY_MEMBER');
          }
        }
      }

      // Pending invite varsa revoke et (yeni token ile değiştir)
      await db
        .update(userInvitations)
        .set({ revoked_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(userInvitations.organization_id, req.activeOrgId!),
            eq(userInvitations.email, email),
            isNull(userInvitations.accepted_at),
            isNull(userInvitations.revoked_at),
          ),
        );

      const tokenPlain = crypto.randomBytes(32).toString('base64url');
      const tokenHash = sha256Hex(tokenPlain);
      const expires_at = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      // tenant_id varsa org'a ait mi doğrula
      if (body.tenant_id) {
        const [t] = await db
          .select()
          .from(tenants)
          .where(and(eq(tenants.id, body.tenant_id), eq(tenants.organization_id, req.activeOrgId!)));
        if (!t) throw new HttpError(400, 'Tenant bu org\'a ait değil', 'INVALID_TENANT');
      }

      const [row] = await db
        .insert(userInvitations)
        .values({
          organization_id: req.activeOrgId!,
          email,
          role: body.role,
          tenant_id: body.tenant_id ?? null,
          invited_by: req.authUser?.auth_account_id ?? null,
          token_hash: tokenHash,
          expires_at,
          notes: body.notes ?? null,
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'user.invite',
        target_type: 'user_invitations',
        target_id: row?.id,
        details: { email, role: body.role, tenant_id: body.tenant_id ?? null },
      });

      const acceptUrl = `${env.PUBLIC_WEB_URL ?? 'https://sayman.deploi.net'}/auth/accept-invite?token=${tokenPlain}`;

      // Gateway yoksa caller (UI) link gösterir
      res.status(201).json({
        data: row,
        action_link: acceptUrl,
        // Plain token yalnız ilk response'da döner (test/dev için); prod'da email gateway gönderir
        token: env.NODE_ENV === 'production' ? undefined : tokenPlain,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/users/invitations — bekleyen davetler
// ---------------------------------------------------------------------------

usersRouter.get(
  '/users/invitations',
  requireAuth,
  requireOrg,
  requirePerm('users.invite'),
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.organization_id, req.activeOrgId!),
            isNull(userInvitations.accepted_at),
            isNull(userInvitations.revoked_at),
          ),
        )
        .orderBy(desc(userInvitations.created_at));
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/users/invitations/:id/revoke
// ---------------------------------------------------------------------------

usersRouter.post(
  '/users/invitations/:id/revoke',
  requireAuth,
  requireOrg,
  requirePerm('users.invite'),
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(userInvitations)
        .set({ revoked_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(userInvitations.id, String(req.params.id ?? '')),
            eq(userInvitations.organization_id, req.activeOrgId!),
            isNull(userInvitations.accepted_at),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Davet bulunamadı veya zaten işleme alınmış', 'NOT_FOUND');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'user.invite_revoked',
        target_type: 'user_invitations',
        target_id: row.id,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/users/invitations/:token/verify (PUBLIC — token'dan davet detayı)
// ---------------------------------------------------------------------------

usersRouter.get('/users/invitations/:token/verify', async (req, res, next) => {
  try {
    const token = String(req.params.token ?? '');
    if (!token) throw new HttpError(400, 'Token gerekli', 'MISSING_TOKEN');

    const db = getDb();
    const [row] = await db
      .select({
        id: userInvitations.id,
        email: userInvitations.email,
        role: userInvitations.role,
        tenant_id: userInvitations.tenant_id,
        expires_at: userInvitations.expires_at,
        accepted_at: userInvitations.accepted_at,
        revoked_at: userInvitations.revoked_at,
        organization_id: userInvitations.organization_id,
        org_name: organizations.name,
        org_slug: organizations.slug,
      })
      .from(userInvitations)
      .innerJoin(organizations, eq(organizations.id, userInvitations.organization_id))
      .where(eq(userInvitations.token_hash, sha256Hex(token)));

    if (!row) throw new HttpError(404, 'Davet bulunamadı', 'NOT_FOUND');
    if (row.revoked_at) throw new HttpError(410, 'Davet iptal edilmiş', 'REVOKED');
    if (row.accepted_at) throw new HttpError(410, 'Davet zaten kullanılmış', 'USED');
    if (row.expires_at < new Date()) throw new HttpError(410, 'Davet süresi dolmuş', 'EXPIRED');

    res.json({
      data: {
        email: row.email,
        role: row.role,
        role_label: ROLE_LABELS[row.role as Role] ?? row.role,
        org_name: row.org_name,
        org_slug: row.org_slug,
        expires_at: row.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /v1/users/accept-invite (PUBLIC)
// ---------------------------------------------------------------------------

const acceptSchema = z.object({
  token: z.string().min(10),
  full_name: z.string().min(2).max(200),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

usersRouter.post('/users/accept-invite', async (req, res, next) => {
  try {
    const body = acceptSchema.parse(req.body);
    consumeRateLimit({ identifier: `accept:ip:${getIp(req) ?? '0'}`, limit: 5, window_seconds: 600 });

    const db = getDb();
    const tokenHash = sha256Hex(body.token);

    const [inv] = await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.token_hash, tokenHash));

    if (!inv) throw new HttpError(404, 'Davet bulunamadı', 'NOT_FOUND');
    if (inv.revoked_at) throw new HttpError(410, 'Davet iptal edilmiş', 'REVOKED');
    if (inv.accepted_at) throw new HttpError(410, 'Davet zaten kullanılmış', 'USED');
    if (inv.expires_at < new Date()) throw new HttpError(410, 'Davet süresi dolmuş', 'EXPIRED');

    const password_hash = await bcrypt.hash(body.password, BCRYPT_COST);

    const result = await db.transaction(async (tx) => {
      // Mevcut account var mı?
      const [existingAcc] = await tx
        .select()
        .from(authAccounts)
        .where(eq(authAccounts.email, inv.email));

      const account =
        existingAcc ??
        (
          await tx
            .insert(authAccounts)
            .values({ email: inv.email, full_name: body.full_name, password_hash })
            .returning()
        )[0]!;

      // Mevcut user var mı?
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.auth_account_id, account.id));

      const user =
        existingUser ??
        (
          await tx
            .insert(users)
            .values({
              auth_account_id: account.id,
              email: inv.email,
              full_name: body.full_name,
            })
            .returning()
        )[0]!;

      // Role insert (org-level)
      await tx
        .insert(userOrganizationRoles)
        .values({
          user_id: user.id,
          organization_id: inv.organization_id,
          role: inv.role as Role,
        })
        .onConflictDoNothing();

      // Tenant override (varsa)
      if (inv.tenant_id) {
        await tx
          .insert(userTenantOverrides)
          .values({
            user_id: user.id,
            tenant_id: inv.tenant_id,
            value: inv.role as Role,
          })
          .onConflictDoNothing();
      }

      // Davet tamam
      await tx
        .update(userInvitations)
        .set({ accepted_at: new Date(), updated_at: new Date() })
        .where(eq(userInvitations.id, inv.id));

      return { account, user };
    });

    const jwt = await signLocalJwt({
      id: result.account.id,
      email: result.account.email,
      ipAddress: getIp(req),
      userAgent: getUa(req),
    });

    await auditFromRequest(req, {
      organization_id: inv.organization_id,
      actor_user_id: result.account.id,
      actor_email: result.account.email,
      action: 'user.invite_accepted',
      target_type: 'user_invitations',
      target_id: inv.id,
    });

    res.status(201).json({
      access_token: jwt,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 3600,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /v1/users/:id/role
// ---------------------------------------------------------------------------

const roleUpdateSchema = z.object({ role: z.enum(ROLES) });

usersRouter.patch(
  '/users/:id/role',
  requireAuth,
  requireOrg,
  requirePerm('users.update_role'),
  async (req, res, next) => {
    try {
      const body = roleUpdateSchema.parse(req.body);
      const db = getDb();

      const [row] = await db
        .update(userOrganizationRoles)
        .set({ role: body.role })
        .where(
          and(
            eq(userOrganizationRoles.user_id, String(req.params.id ?? '')),
            eq(userOrganizationRoles.organization_id, req.activeOrgId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Kullanıcı bu org\'da bulunamadı', 'NOT_FOUND');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'user.role_changed',
        target_type: 'user_organization_roles',
        target_id: row.user_id,
        details: { new_role: body.role },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/users/:id/tenant-override
// ---------------------------------------------------------------------------

const overrideSchema = z.object({
  tenant_id: z.string().uuid(),
  value: z.enum(TENANT_OVERRIDE_VALUES),
});

usersRouter.post(
  '/users/:id/tenant-override',
  requireAuth,
  requireOrg,
  requirePerm('users.update_role'),
  async (req, res, next) => {
    try {
      const body = overrideSchema.parse(req.body);
      const db = getDb();

      // Tenant org'a ait mi?
      const [t] = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.id, body.tenant_id), eq(tenants.organization_id, req.activeOrgId!)));
      if (!t) throw new HttpError(400, 'Tenant bu org\'a ait değil', 'INVALID_TENANT');

      const userId = String(req.params.id ?? '');

      // Upsert via insert + onConflictDoUpdate
      const [row] = await db
        .insert(userTenantOverrides)
        .values({ user_id: userId, tenant_id: body.tenant_id, value: body.value })
        .onConflictDoUpdate({
          target: [userTenantOverrides.user_id, userTenantOverrides.tenant_id],
          set: { value: body.value },
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'user.tenant_override_set',
        target_type: 'user_tenant_overrides',
        target_id: row?.id,
        details: { user_id: userId, tenant_id: body.tenant_id, value: body.value },
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /v1/users/:id — org'dan çıkar
// ---------------------------------------------------------------------------

usersRouter.delete(
  '/users/:id',
  requireAuth,
  requireOrg,
  requirePerm('users.remove'),
  async (req, res, next) => {
    try {
      const userId = String(req.params.id ?? '');
      const db = getDb();

      // Self-remove engelle
      if (req.authUser?.id === userId) {
        throw new HttpError(400, 'Kendi rolünü kaldıramazsın', 'SELF_REMOVE');
      }

      // Role sil
      const [removedRole] = await db
        .delete(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.user_id, userId),
            eq(userOrganizationRoles.organization_id, req.activeOrgId!),
          ),
        )
        .returning();

      if (!removedRole) throw new HttpError(404, 'Kullanıcı bu org\'da bulunamadı', 'NOT_FOUND');

      // Tenant override'ları da sil
      const orgTenants = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.organization_id, req.activeOrgId!));
      const tenantIds = orgTenants.map((t) => t.id);
      if (tenantIds.length > 0) {
        await db
          .delete(userTenantOverrides)
          .where(
            sql`${userTenantOverrides.user_id} = ${userId} AND ${userTenantOverrides.tenant_id} = ANY(${tenantIds})`,
          );
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'user.removed',
        target_type: 'user_organization_roles',
        target_id: userId,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
