/**
 * /v1/cari/:id/portal-tokens — Müşteri portali token yönetimi (auth gerekli).
 * /v1/portal/:token              — Public portal endpoint (auth-less, token doğrulamalı).
 *
 * Müşteri portali = bir carinin ekstresini + faturalarını public link ile paylaşmak.
 * Hassas veriler korumalı: token zorunlu, IP loglu, süre dolunca kapanır.
 */
import crypto from 'node:crypto';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  cariAccounts,
  cariMovements,
  customerPortalTokens,
  getDb,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const customerPortalRouter = Router();

function genPortalToken(): string {
  return 'sp_' + crypto.randomBytes(36).toString('base64url');
}

// ---- AUTH'LU yönetim ----

customerPortalRouter.get(
  '/cari/:id/portal-tokens',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [cari] = await db
        .select({ id: cariAccounts.id })
        .from(cariAccounts)
        .where(
          and(
            eq(cariAccounts.id, String(req.params.id ?? '')),
            eq(cariAccounts.tenant_id, req.activeTenantId!),
          ),
        );
      if (!cari) throw new HttpError(404, 'Cari bulunamadı');

      const rows = await db
        .select({
          id: customerPortalTokens.id,
          label: customerPortalTokens.label,
          expires_at: customerPortalTokens.expires_at,
          is_active: customerPortalTokens.is_active,
          revoked_at: customerPortalTokens.revoked_at,
          access_count: customerPortalTokens.access_count,
          last_accessed_at: customerPortalTokens.last_accessed_at,
          last_accessed_ip: customerPortalTokens.last_accessed_ip,
          created_at: customerPortalTokens.created_at,
        })
        .from(customerPortalTokens)
        .where(eq(customerPortalTokens.cari_account_id, cari.id))
        .orderBy(desc(customerPortalTokens.created_at));
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

const createSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  /** Süre — gün olarak (default 90 gün, max 365) */
  expires_in_days: z.number().int().min(1).max(365).default(90),
});

customerPortalRouter.post(
  '/cari/:id/portal-tokens',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin', 'yonetici'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Token üretme yetkisi yok');
      }
      const body = createSchema.parse(req.body);
      const db = getDb();
      const [cari] = await db
        .select({ id: cariAccounts.id, name: cariAccounts.name })
        .from(cariAccounts)
        .where(
          and(
            eq(cariAccounts.id, String(req.params.id ?? '')),
            eq(cariAccounts.tenant_id, req.activeTenantId!),
          ),
        );
      if (!cari) throw new HttpError(404, 'Cari bulunamadı');

      const token = genPortalToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + body.expires_in_days);

      const [row] = await db
        .insert(customerPortalTokens)
        .values({
          tenant_id: req.activeTenantId!,
          cari_account_id: cari.id,
          token,
          label: body.label ?? null,
          expires_at: expiresAt,
          created_by: req.authUser?.id ?? null,
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'customer_portal.token.create',
        target_type: 'customer_portal_tokens',
        target_id: row?.id,
        details: { cari_id: cari.id, expires_at: expiresAt.toISOString() },
      });

      // Token sadece bir kez döner — UI saklamalı / kopyalamalı
      res.status(201).json({
        data: row,
        url: `/portal/${token}`,
        token,
      });
    } catch (err) {
      next(err);
    }
  },
);

customerPortalRouter.post(
  '/cari/portal-tokens/:id/revoke',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(customerPortalTokens)
        .set({ is_active: false, revoked_at: new Date() })
        .where(
          and(
            eq(customerPortalTokens.id, String(req.params.id ?? '')),
            eq(customerPortalTokens.tenant_id, req.activeTenantId!),
          ),
        )
        .returning({ id: customerPortalTokens.id });
      if (!row) throw new HttpError(404, 'Token bulunamadı');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---- PUBLIC PORTAL (auth-less, token doğrulamalı) ----

customerPortalRouter.get('/portal/:token', async (req, res, next) => {
  try {
    // Brute-force koruması — IP başına dakikada 20 deneme
    const ipForLimit = (req.ip ?? req.socket.remoteAddress ?? 'unknown').slice(0, 64);
    await consumeRateLimit({ identifier: `portal:${ipForLimit}`, limit: 20, window_seconds: 60 });

    const token = String(req.params.token ?? '');
    if (token.length < 20) throw new HttpError(401, 'Geçersiz token');

    const db = getDb();
    const [t] = await db
      .select()
      .from(customerPortalTokens)
      .where(
        and(
          eq(customerPortalTokens.token, token),
          eq(customerPortalTokens.is_active, true),
          gt(customerPortalTokens.expires_at, new Date()),
        ),
      );
    if (!t) throw new HttpError(401, 'Token geçersiz veya süresi dolmuş');

    // Erişim sayacı + IP
    const ip = (req.ip ?? req.socket.remoteAddress ?? '').slice(0, 64);
    await db
      .update(customerPortalTokens)
      .set({
        access_count: sql`${customerPortalTokens.access_count} + 1`,
        last_accessed_at: new Date(),
        last_accessed_ip: ip,
      })
      .where(eq(customerPortalTokens.id, t.id));

    // Cari + son 100 hareket
    const [cari] = await db
      .select({
        id: cariAccounts.id,
        name: cariAccounts.name,
        code: cariAccounts.code,
        tax_id: cariAccounts.tax_id,
        tax_office: cariAccounts.tax_office,
        balance: cariAccounts.balance,
        currency: cariAccounts.currency,
      })
      .from(cariAccounts)
      .where(eq(cariAccounts.id, t.cari_account_id));
    if (!cari) throw new HttpError(404, 'Cari bulunamadı');

    const movements = await db
      .select({
        id: cariMovements.id,
        movement_date: cariMovements.movement_date,
        description: cariMovements.description,
        document_no: cariMovements.document_no,
        debit: cariMovements.debit,
        credit: cariMovements.credit,
        currency: cariMovements.currency,
      })
      .from(cariMovements)
      .where(eq(cariMovements.cari_account_id, cari.id))
      .orderBy(desc(cariMovements.movement_date))
      .limit(100);

    res.json({
      data: {
        cari,
        movements,
        token_label: t.label,
        expires_at: t.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
});
