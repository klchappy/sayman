/**
 * /v1/banks — Banka master data. Her zaman organization-shared (share_scope yok).
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { banks, getDb } from '@sayman/db';
import { requireAuth } from '../../middleware/auth';
import { auditFromRequest } from '../../lib/audit';
import { HttpError, requireOrg } from '../../lib/helpers';

const createSchema = z.object({
  name: z.string().min(2).max(200),
  short_code: z.string().max(32).optional().nullable(),
});
const updateSchema = createSchema.partial();

export const banksRouter = Router();

banksRouter.get('/banks', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(banks)
      .where(eq(banks.organization_id, req.activeOrgId!))
      .orderBy(desc(banks.created_at));
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

banksRouter.post('/banks', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(banks)
      .values({
        organization_id: req.activeOrgId!,
        name: body.name,
        short_code: body.short_code ?? null,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'bank.create',
      target_type: 'banks',
      target_id: row?.id ?? null,
      details: { name: body.name, short_code: body.short_code ?? null },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

banksRouter.patch('/banks/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(banks)
      .set({ ...body, updated_at: new Date() })
      .where(and(eq(banks.id, String(req.params.id ?? '')), eq(banks.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Banka bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'bank.update',
      target_type: 'banks',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { patch: body },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

banksRouter.delete('/banks/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(banks)
      .set({ is_active: false, updated_at: new Date() })
      .where(and(eq(banks.id, String(req.params.id ?? '')), eq(banks.organization_id, req.activeOrgId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Banka bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'bank.delete',
      target_type: 'banks',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
