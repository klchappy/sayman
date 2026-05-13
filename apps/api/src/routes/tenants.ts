/**
 * /v1/tenants — tenant resolve + active-tenant ctx.
 *
 * GET /v1/tenants/me → şu anki subdomain'den çözülen aktif tenant bilgisi
 * GET /v1/tenants?org=kilic → bir organization'ın tenant listesi
 */
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { SECTOR_DEFAULT_MODULES, SECTOR_LABELS, type Sector } from '@sayman/shared';
import { getDb, organizations, tenants } from '@sayman/db';

export const tenantsRouter = Router();

tenantsRouter.get('/tenants/me', (req, res) => {
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
});

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

    res.json({ data: enriched, count: enriched.length, organization: { id: org.id, slug: org.slug, name: org.name } });
  } catch (err) {
    next(err);
  }
});
