/**
 * /v1/organizations — control plane endpoint'leri.
 *
 *   GET    /v1/organizations               → list (public — auth gerekli)
 *   GET    /v1/organizations/:slug         → detay (tenants dahil)
 *   PATCH  /v1/organizations/:slug         → org düzenle (super_admin / organization_admin)
 *
 * Slug değişikliği şimdilik kabul edilmiyor (subdomain routing, cache, URL'ler kırılmasın).
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { PLANS } from '@sayman/shared';
import { getDb, organizations, tenants, userOrganizationRoles } from '@sayman/db';
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
