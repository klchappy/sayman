/**
 * /v1/tenants — tenant resolve + CRUD.
 *
 * GET    /v1/tenants/me               → şu anki subdomain'den çözülen aktif tenant
 * GET    /v1/tenants?org=kilic        → bir organization'ın tenant listesi
 * POST   /v1/tenants                  → yeni tenant (super_admin/yönetici)
 * PATCH  /v1/tenants/:id              → güncelle (name, sector, active_modules)
 * DELETE /v1/tenants/:id              → soft delete (is_active=false)
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  MODULES,
  SECTORS,
  SECTOR_DEFAULT_MODULES,
  SECTOR_LABELS,
  type Sector,
} from '@sayman/shared';
import { getDb, organizations, tenants } from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { auditFromRequest } from '../lib/audit';
import { requireAuth } from '../middleware/auth';

export const tenantsRouter = Router();

const slugify = (s: string) =>
  s
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

const moduleSchema = z.enum(MODULES);
const sectorSchema = z.enum(SECTORS);

const createSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Yalnız küçük harf, rakam ve tire')
    .optional(),
  name: z.string().min(2).max(120),
  sector: sectorSchema,
  tax_number: z.string().max(20).optional().nullable(),
  active_modules: z.array(moduleSchema).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  sector: sectorSchema.optional(),
  tax_number: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/[^0-9]/g, '') : v)),
  active_modules: z.array(moduleSchema).optional(),
  is_active: z.boolean().optional(),
});

const ALLOWED_WRITE_ROLES = new Set([
  'super_admin',
  'organization_admin',
  'yonetici',
]);

// --- GET /tenants/me --------------------------------------------------------

tenantsRouter.get('/tenants/me', (req, res, next) => {
  try {
    const ctx = req.saymanContext;
    if (!ctx || !ctx.tenantId) {
      res.status(404).json({
        error: 'no_tenant_context',
        hint: 'Subdomain ({tenant}.{org}.host) veya X-Sayman-Org+X-Sayman-Tenant header gerekli.',
        received: ctx ?? null,
      });
      return;
    }
    res.json({ data: ctx });
  } catch (err) {
    next(err);
  }
});

// --- GET /tenants?org=... ---------------------------------------------------

tenantsRouter.get('/tenants', async (req, res, next) => {
  try {
    const db = getDb();
    const orgSlug = (req.query.org as string | undefined) ?? req.saymanContext?.orgSlug;

    if (!orgSlug) {
      res.status(400).json({ error: 'org_required', hint: '?org=<slug> veya subdomain' });
      return;
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug));
    if (!org) {
      res.status(404).json({ error: 'org_not_found' });
      return;
    }

    const list = await db.select().from(tenants).where(eq(tenants.organization_id, org.id));

    const enriched = list.map((t) => ({
      ...t,
      sector_label: SECTOR_LABELS[t.sector as Sector],
      effective_modules:
        t.active_modules.length > 0
          ? t.active_modules
          : [...SECTOR_DEFAULT_MODULES[t.sector as Sector]],
    }));

    res.json({
      data: enriched,
      count: enriched.length,
      organization: { id: org.id, slug: org.slug, name: org.name },
    });
  } catch (err) {
    next(err);
  }
});

// --- POST /tenants ----------------------------------------------------------

tenantsRouter.post('/tenants', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!ALLOWED_WRITE_ROLES.has(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Tenant açmak için yönetici yetkisi gerekli', 'FORBIDDEN');
    }

    const body = createSchema.parse(req.body);
    const db = getDb();

    // Slug uniqueness (org içinde)
    const baseSlug = body.slug ?? slugify(body.name);
    if (!baseSlug) throw new HttpError(400, 'Slug üretilemedi', 'INVALID_SLUG');

    let finalSlug = baseSlug;
    for (let i = 1; i < 50; i++) {
      const [exists] = await db
        .select()
        .from(tenants)
        .where(
          and(
            eq(tenants.organization_id, req.activeOrgId!),
            eq(tenants.slug, finalSlug),
          ),
        );
      if (!exists) break;
      finalSlug = `${baseSlug}-${i}`;
    }

    const activeModules =
      body.active_modules ?? [...SECTOR_DEFAULT_MODULES[body.sector]];

    const [row] = await db
      .insert(tenants)
      .values({
        organization_id: req.activeOrgId!,
        slug: finalSlug,
        name: body.name,
        sector: body.sector,
        tax_number: body.tax_number ? body.tax_number.replace(/[^0-9]/g, '') : null,
        active_modules: activeModules,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'tenant.create',
      target_type: 'tenants',
      target_id: row?.id,
      details: { slug: finalSlug, sector: body.sector, modules_count: activeModules.length },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

// --- PATCH /tenants/:id -----------------------------------------------------

tenantsRouter.patch('/tenants/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!ALLOWED_WRITE_ROLES.has(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Tenant güncellemek için yönetici yetkisi gerekli', 'FORBIDDEN');
    }

    const body = updateSchema.parse(req.body);
    const db = getDb();

    const [existing] = await db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.id, String(req.params.id ?? '')),
          eq(tenants.organization_id, req.activeOrgId!),
        ),
      );
    if (!existing) throw new HttpError(404, 'Tenant bulunamadı', 'NOT_FOUND');

    const [row] = await db
      .update(tenants)
      .set({ ...body, updated_at: new Date() })
      .where(eq(tenants.id, existing.id))
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'tenant.update',
      target_type: 'tenants',
      target_id: existing.id,
      details: body,
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// --- DELETE /tenants/:id ----------------------------------------------------
// ?hard=true → kayıt tamamen DB'den silinir (cascade ile tüm fatura/data gider!)
// Aksi halde soft delete (is_active=false) — pasif yapar, veri korunur.
// Sadece super_admin hard delete yapabilir.

tenantsRouter.delete('/tenants/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!ALLOWED_WRITE_ROLES.has(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Tenant kapatmak için yönetici yetkisi gerekli', 'FORBIDDEN');
    }

    const db = getDb();
    const tenantId = String(req.params.id ?? '');
    const hardDelete = req.query.hard === 'true' || req.query.hard === '1';

    if (hardDelete && req.effectiveRole !== 'super_admin') {
      throw new HttpError(
        403,
        'Tenant\'ı kalıcı silmek için super_admin yetkisi gerekli',
        'HARD_DELETE_FORBIDDEN',
      );
    }

    // Mevcudiyet ve org kontrolü
    const [existing] = await db
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.id, tenantId),
          eq(tenants.organization_id, req.activeOrgId!),
        ),
      );
    if (!existing) throw new HttpError(404, 'Tenant bulunamadı', 'NOT_FOUND');

    if (hardDelete) {
      // CASCADE ile tüm tenant-scoped veri silinir (payable_items, sales_invoices,
      // payments, checks, fixed_assets, employees, vb. — schema'lara ondelete='cascade')
      await db.delete(tenants).where(eq(tenants.id, tenantId));

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'tenant.hard_delete',
        target_type: 'tenants',
        target_id: tenantId,
        details: { name: existing.name, slug: existing.slug, hard: true },
      });

      res.json({
        ok: true,
        hard_deleted: true,
        message: `${existing.name} kalıcı olarak silindi (tüm tenant verisi cascade).`,
      });
      return;
    }

    // Soft delete
    const [row] = await db
      .update(tenants)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'tenant.deactivate',
      target_type: 'tenants',
      target_id: row.id,
    });

    res.json({ data: row, message: `${row.name} pasifleştirildi (veri korundu).` });
  } catch (err) {
    next(err);
  }
});

// --- POST /tenants/:id/reactivate — pasif tenant'ı yeniden aktive et ---------

tenantsRouter.post(
  '/tenants/:id/reactivate',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!ALLOWED_WRITE_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const db = getDb();
      const [row] = await db
        .update(tenants)
        .set({ is_active: true, updated_at: new Date() })
        .where(
          and(
            eq(tenants.id, String(req.params.id ?? '')),
            eq(tenants.organization_id, req.activeOrgId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Tenant bulunamadı', 'NOT_FOUND');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'tenant.reactivate',
        target_type: 'tenants',
        target_id: row.id,
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);
