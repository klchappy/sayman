/**
 * /v1/properties — Mülk master data. share_scope ile tenant filtresi.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, properties } from '@sayman/db';
import { requireAuth } from '../../middleware/auth';
import { auditFromRequest } from '../../lib/audit';
import { HttpError, requireOrg, shareScopeWhereSQL } from '../../lib/helpers';

const shareScopeSchema = z.union([z.literal('*'), z.array(z.string().min(1)).min(1)]);
const createSchema = z.object({
  name: z.string().min(2).max(200),
  property_type: z.string().max(64).optional().nullable(),
  owner_person_id: z.string().uuid().optional().nullable(),
  owner_company_id: z.string().uuid().optional().nullable(),
  municipality: z.string().max(128).optional().nullable(),
  registry_number: z.string().max(64).optional().nullable(),
  site_unit_code: z.string().max(32).optional().nullable(),
  share_scope: shareScopeSchema.default('*'),
});
const updateSchema = createSchema.partial();

export const propertiesRouter = Router();

propertiesRouter.get('/properties', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    let where = eq(properties.organization_id, req.activeOrgId!);
    if (req.saymanContext?.tenantSlug && req.saymanContext?.tenantId) {
      where = and(where, shareScopeWhereSQL(req.saymanContext.tenantSlug)) as typeof where;
    }
    const rows = await db.select().from(properties).where(where).orderBy(desc(properties.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

propertiesRouter.post('/properties', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(properties)
      .values({
        organization_id: req.activeOrgId!,
        name: body.name,
        property_type: body.property_type ?? null,
        owner_person_id: body.owner_person_id ?? null,
        owner_company_id: body.owner_company_id ?? null,
        municipality: body.municipality ?? null,
        registry_number: body.registry_number ?? null,
        site_unit_code: body.site_unit_code ?? null,
        share_scope: body.share_scope,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'property.create',
      target_type: 'properties',
      target_id: row?.id ?? null,
      details: {
        name: body.name,
        property_type: body.property_type ?? null,
        share_scope: body.share_scope,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

propertiesRouter.patch('/properties/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(properties)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(properties.id, String(req.params.id ?? '')),
          eq(properties.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Mülk bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'property.update',
      target_type: 'properties',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { patch: body },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

propertiesRouter.delete('/properties/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(properties)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(properties.id, String(req.params.id ?? '')),
          eq(properties.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Mülk bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'property.delete',
      target_type: 'properties',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
