/**
 * /v1/companies — Şirket (Company) CRUD. share_scope ile tenant filtresi.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, companies } from '@sayman/db';
import { requireAuth } from '../../middleware/auth';
import { auditFromRequest } from '../../lib/audit';
import { HttpError, requireOrg, shareScopeWhereSQL } from '../../lib/helpers';

const shareScopeSchema = z.union([z.literal('*'), z.array(z.string().min(1)).min(1)]);
const createSchema = z.object({
  name: z.string().min(2).max(200),
  short_name: z.string().max(64).optional().nullable(),
  tax_number: z.string().max(32).optional().nullable(),
  registry_number: z.string().max(64).optional().nullable(),
  share_scope: shareScopeSchema.default('*'),
});
const updateSchema = createSchema.partial();

export const companiesRouter = Router();

companiesRouter.get('/companies', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    let where: ReturnType<typeof eq> | ReturnType<typeof and> = and(
      eq(companies.organization_id, req.activeOrgId!),
      eq(companies.is_active, true),
    )!;
    if (req.saymanContext?.tenantSlug && req.saymanContext?.tenantId) {
      where = and(where, shareScopeWhereSQL(req.saymanContext.tenantSlug)) as typeof where;
    }
    const rows = await db.select().from(companies).where(where).orderBy(desc(companies.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

companiesRouter.post('/companies', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(companies)
      .values({
        organization_id: req.activeOrgId!,
        name: body.name,
        short_name: body.short_name ?? null,
        tax_number: body.tax_number ?? null,
        registry_number: body.registry_number ?? null,
        share_scope: body.share_scope,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'company.create',
      target_type: 'companies',
      target_id: row?.id ?? null,
      details: {
        name: body.name,
        tax_number: body.tax_number ?? null,
        share_scope: body.share_scope,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

companiesRouter.get('/companies/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, String(req.params.id ?? '')),
          eq(companies.organization_id, req.activeOrgId!),
          eq(companies.is_active, true),
        ),
      );
    if (!row) throw new HttpError(404, 'Şirket bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

companiesRouter.patch('/companies/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(companies)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(companies.id, String(req.params.id ?? '')), eq(companies.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Şirket bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'company.update',
      target_type: 'companies',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { patch: body },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

companiesRouter.delete('/companies/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(companies)
      .set({ is_active: false, updated_at: new Date() })
      .where(and(eq(companies.id, String(req.params.id ?? '')), eq(companies.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Şirket bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'company.delete',
      target_type: 'companies',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
