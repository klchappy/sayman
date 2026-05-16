/**
 * /v1/institutions — Kurum master (TT, CK, İGDAŞ, BAĞKUR vb). Org-shared.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, institutions } from '@sayman/db';
import { requireAuth } from '../../middleware/auth';
import { auditFromRequest } from '../../lib/audit';
import { HttpError, requireOrg } from '../../lib/helpers';

const createSchema = z.object({
  name: z.string().min(2).max(200),
  institution_type: z.string().max(64).optional().nullable(),
});
const updateSchema = createSchema.partial();

export const institutionsRouter = Router();

institutionsRouter.get('/institutions', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(institutions)
      .where(and(eq(institutions.organization_id, req.activeOrgId!), eq(institutions.is_active, true)))
      .orderBy(desc(institutions.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

institutionsRouter.post('/institutions', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(institutions)
      .values({
        organization_id: req.activeOrgId!,
        name: body.name,
        institution_type: body.institution_type ?? null,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'institution.create',
      target_type: 'institutions',
      target_id: row?.id ?? null,
      details: { name: body.name, institution_type: body.institution_type ?? null },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

institutionsRouter.patch('/institutions/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(institutions)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(institutions.id, String(req.params.id ?? '')),
          eq(institutions.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Kurum bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'institution.update',
      target_type: 'institutions',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { patch: body },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

institutionsRouter.delete('/institutions/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(institutions)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(institutions.id, String(req.params.id ?? '')),
          eq(institutions.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Kurum bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'institution.delete',
      target_type: 'institutions',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
