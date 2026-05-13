/**
 * /v1/organizations — control plane (PUBLIC) endpoint'leri.
 *
 * Sadece organization list + detay (read-only). Yaratma/güncelleme Faz F
 * (SaaS Onboarding) ile gelir.
 */
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, organizations, tenants } from '@sayman/db';

export const organizationsRouter = Router();

organizationsRouter.get('/organizations', async (_req, res, next) => {
  try {
    const db = getDb();
    const orgs = await db.select().from(organizations);
    res.json({ data: orgs, count: orgs.length });
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get('/organizations/:slug', async (req, res, next) => {
  try {
    const db = getDb();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, req.params.slug ?? ''));
    if (!org) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const orgTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.organization_id, org.id));
    res.json({ data: { ...org, tenants: orgTenants } });
  } catch (err) {
    next(err);
  }
});
