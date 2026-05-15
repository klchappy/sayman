/**
 * /v1/official-payments — BAĞKUR/SSK/BES/İTO/vergi profilleri.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, officialPaymentPeriods, officialPaymentProfiles } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const createSchema = z.object({
  payment_type: z.enum(['BAGKUR', 'SSK', 'BES', 'ITO', 'KGK', 'GELIR', 'KDV', 'MTV', 'OTHER']),
  frequency: z.enum(['monthly', 'quarterly', 'yearly', 'semiannual', 'occasional']).default('monthly'),
  owner_type: z.enum(['company', 'person', 'family', 'other']),
  company_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
  typical_amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  currency: z.string().length(3).default('TRY'),
  notes: z.string().optional().nullable(),
});
const updateSchema = createSchema.partial();

export const officialPaymentsRouter = Router();

officialPaymentsRouter.get('/official-payments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(officialPaymentProfiles)
      .where(
        and(
          eq(officialPaymentProfiles.tenant_id, req.activeTenantId!),
          eq(officialPaymentProfiles.is_active, true),
        ),
      )
      .orderBy(desc(officialPaymentProfiles.created_at))
      .limit(200);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

officialPaymentsRouter.post('/official-payments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(officialPaymentProfiles)
      .values({ tenant_id: req.activeTenantId!, ...body })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

officialPaymentsRouter.patch('/official-payments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(officialPaymentProfiles)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(officialPaymentProfiles.id, String(req.params.id ?? '')),
          eq(officialPaymentProfiles.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Profil bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

officialPaymentsRouter.delete('/official-payments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(officialPaymentProfiles)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(officialPaymentProfiles.id, String(req.params.id ?? '')),
          eq(officialPaymentProfiles.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Profil bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

officialPaymentsRouter.get(
  '/official-payments/:id/periods',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(officialPaymentPeriods)
        .where(
          and(
            eq(officialPaymentPeriods.profile_id, String(req.params.id ?? '')),
            eq(officialPaymentPeriods.tenant_id, req.activeTenantId!),
          ),
        )
        .orderBy(asc(officialPaymentPeriods.due_date));
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);
