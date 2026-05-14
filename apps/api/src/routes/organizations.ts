/**
 * /v1/organizations — control plane endpoint'leri.
 *
 *   GET    /v1/organizations               → list (public — auth gerekli)
 *   GET    /v1/organizations/:slug         → detay (tenants dahil)
 *   PATCH  /v1/organizations/:slug         → org düzenle (super_admin / organization_admin)
 *
 * Slug değişikliği şimdilik kabul edilmiyor (subdomain routing, cache, URL'ler kırılmasın).
 */
import { and, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { PLANS } from '@sayman/shared';
import {
  getDb,
  guarantees,
  organizations,
  payableItems,
  subscriptions,
  tenants,
  userOrganizationRoles,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const organizationsRouter = Router();

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  contact_email: z.string().email().optional().nullable(),
  plan: z.enum(PLANS).optional(),
  trial_ends_at: z.string().datetime().optional().nullable(),
});

// LIST — auth gerekli (her user kendi org'larını /me'den çeker; bu endpoint full liste için super_admin)
organizationsRouter.get('/organizations', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    // Sadece üye olduğun org'lar
    const orgs = await db
      .selectDistinct({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        plan: organizations.plan,
        contact_email: organizations.contact_email,
        is_active: organizations.is_active,
      })
      .from(organizations)
      .innerJoin(userOrganizationRoles, eq(userOrganizationRoles.organization_id, organizations.id))
      .where(eq(userOrganizationRoles.user_id, req.authUser!.id));
    res.json({ data: orgs, count: orgs.length });
  } catch (err) {
    next(err);
  }
});

// DETAIL
organizationsRouter.get('/organizations/:slug', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, String(req.params.slug ?? '')));
    if (!org) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Üyelik kontrolü
    const [member] = await db
      .select()
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.user_id, req.authUser!.id),
          eq(userOrganizationRoles.organization_id, org.id),
        ),
      );
    if (!member) throw new HttpError(403, 'Bu org\'a üye değilsin', 'NOT_MEMBER');

    const orgTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.organization_id, org.id));
    res.json({ data: { ...org, tenants: orgTenants } });
  } catch (err) {
    next(err);
  }
});

// CONSOLIDATED SUMMARY — Holding sayfası, tüm tenant'ların toplam metrikleri
organizationsRouter.get(
  '/organizations/:slug/summary',
  requireAuth,
  async (req, res, next) => {
    try {
      const db = getDb();
      const slug = String(req.params.slug ?? '');

      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
      if (!org) throw new HttpError(404, 'Organization bulunamadı', 'NOT_FOUND');

      // Üyelik kontrolü
      const [member] = await db
        .select()
        .from(userOrganizationRoles)
        .where(
          and(
            eq(userOrganizationRoles.user_id, req.authUser!.id),
            eq(userOrganizationRoles.organization_id, org.id),
          ),
        );
      if (!member) throw new HttpError(403, 'Bu org\'a üye değilsin', 'NOT_MEMBER');

      // Tenant listesi
      const tList = await db.select().from(tenants).where(eq(tenants.organization_id, org.id));
      const tenantIds = tList.map((t) => t.id);
      const tenantNameMap = new Map(tList.map((t) => [t.id, t.name]));

      if (tenantIds.length === 0) {
        res.json({
          data: {
            organization: { id: org.id, slug: org.slug, name: org.name, plan: org.plan },
            tenant_count: 0,
            consolidated: {
              total_payables: 0,
              total_paid: 0,
              total_open: 0,
              overdue_count: 0,
              approaching_count: 0,
              active_subscriptions: 0,
              monthly_subscription: 0,
              active_guarantees: 0,
              guarantees_total: 0,
            },
            per_tenant: [],
          },
        });
        return;
      }

      // Payables aggregate per tenant
      const payRows = await db
        .select({
          tenant_id: payableItems.tenant_id,
          total: sql<string>`COALESCE(SUM(${payableItems.amount}), 0)`,
          paid: sql<string>`COALESCE(SUM(${payableItems.paid_amount}), 0)`,
          overdue: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'overdue')`,
          approaching: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'approaching')`,
        })
        .from(payableItems)
        .where(
          and(
            sql`${payableItems.tenant_id} = ANY(${tenantIds})`,
            eq(payableItems.is_active, true),
          ),
        )
        .groupBy(payableItems.tenant_id);

      // Subs aggregate per tenant
      const subRows = await db
        .select({
          tenant_id: subscriptions.tenant_id,
          active_count: sql<string>`COUNT(*) FILTER (WHERE ${subscriptions.status} = 'active')`,
          monthly_total: sql<string>`COALESCE(SUM(${subscriptions.monthly_amount}) FILTER (WHERE ${subscriptions.status} = 'active'), 0)`,
        })
        .from(subscriptions)
        .where(
          and(
            sql`${subscriptions.tenant_id} = ANY(${tenantIds})`,
            eq(subscriptions.is_active, true),
          ),
        )
        .groupBy(subscriptions.tenant_id);

      // Guarantees aggregate per tenant
      const gRows = await db
        .select({
          tenant_id: guarantees.tenant_id,
          active_count: sql<string>`COUNT(*) FILTER (WHERE ${guarantees.status} = 'active')`,
          total: sql<string>`COALESCE(SUM(${guarantees.amount}) FILTER (WHERE ${guarantees.status} = 'active'), 0)`,
        })
        .from(guarantees)
        .where(
          and(sql`${guarantees.tenant_id} = ANY(${tenantIds})`, eq(guarantees.is_active, true)),
        )
        .groupBy(guarantees.tenant_id);

      const payMap = new Map(payRows.map((r) => [r.tenant_id, r]));
      const subMap = new Map(subRows.map((r) => [r.tenant_id, r]));
      const gMap = new Map(gRows.map((r) => [r.tenant_id, r]));

      // Per-tenant breakdown
      const perTenant = tList.map((t) => {
        const p = payMap.get(t.id);
        const s = subMap.get(t.id);
        const g = gMap.get(t.id);
        const total = Number(p?.total ?? 0);
        const paid = Number(p?.paid ?? 0);
        return {
          tenant_id: t.id,
          tenant_slug: t.slug,
          tenant_name: t.name,
          sector: t.sector,
          total_payables: total,
          total_paid: paid,
          total_open: total - paid,
          overdue_count: Number(p?.overdue ?? 0),
          approaching_count: Number(p?.approaching ?? 0),
          active_subscriptions: Number(s?.active_count ?? 0),
          monthly_subscription: Number(s?.monthly_total ?? 0),
          active_guarantees: Number(g?.active_count ?? 0),
          guarantees_total: Number(g?.total ?? 0),
        };
      });

      // Consolidated rollup
      const consolidated = perTenant.reduce(
        (acc, t) => ({
          total_payables: acc.total_payables + t.total_payables,
          total_paid: acc.total_paid + t.total_paid,
          total_open: acc.total_open + t.total_open,
          overdue_count: acc.overdue_count + t.overdue_count,
          approaching_count: acc.approaching_count + t.approaching_count,
          active_subscriptions: acc.active_subscriptions + t.active_subscriptions,
          monthly_subscription: acc.monthly_subscription + t.monthly_subscription,
          active_guarantees: acc.active_guarantees + t.active_guarantees,
          guarantees_total: acc.guarantees_total + t.guarantees_total,
        }),
        {
          total_payables: 0,
          total_paid: 0,
          total_open: 0,
          overdue_count: 0,
          approaching_count: 0,
          active_subscriptions: 0,
          monthly_subscription: 0,
          active_guarantees: 0,
          guarantees_total: 0,
        },
      );

      res.json({
        data: {
          organization: { id: org.id, slug: org.slug, name: org.name, plan: org.plan },
          tenant_count: tList.length,
          consolidated,
          per_tenant: perTenant,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH — org düzenle (super_admin / organization_admin)
organizationsRouter.patch('/organizations/:slug', requireAuth, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const slug = String(req.params.slug ?? '');

    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    if (!org) throw new HttpError(404, 'Organization bulunamadı', 'NOT_FOUND');

    // Yetki: bu org'da super_admin veya organization_admin olmalı
    const [role] = await db
      .select({ role: userOrganizationRoles.role })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.user_id, req.authUser!.id),
          eq(userOrganizationRoles.organization_id, org.id),
        ),
      );
    if (!role || !['super_admin', 'organization_admin'].includes(role.role)) {
      throw new HttpError(403, 'Org düzenlemek için yönetici yetkisi gerekli', 'FORBIDDEN');
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.contact_email !== undefined) updateData.contact_email = body.contact_email;
    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.trial_ends_at !== undefined) {
      updateData.trial_ends_at = body.trial_ends_at ? new Date(body.trial_ends_at) : null;
    }

    const [row] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, org.id))
      .returning();

    await auditFromRequest(req, {
      organization_id: org.id,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'organization.update',
      target_type: 'organizations',
      target_id: org.id,
      details: body,
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
