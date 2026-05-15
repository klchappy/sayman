/**
 * /v1/regular-payments — Kira ve düzenli ödeme sözleşmeleri (profile).
 * periods sub-resource: /v1/regular-payments/:id/periods
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, regularPaymentPeriods, regularPaymentProfiles } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const ownerTypeSchema = z.enum(['company', 'person', 'family', 'other']);

const createProfileSchema = z.object({
  kind: z.enum(['rent', 'maintenance', 'subscription', 'lease', 'other']).default('rent'),
  title: z.string().min(2).max(255),
  landlord_owner_type: ownerTypeSchema.optional().nullable(),
  landlord_company_id: z.string().uuid().optional().nullable(),
  landlord_person_id: z.string().uuid().optional().nullable(),
  payer_owner_type: ownerTypeSchema.optional().nullable(),
  payer_company_id: z.string().uuid().optional().nullable(),
  payer_person_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  monthly_amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).default('TRY'),
  payment_day: z.number().int().min(1).max(31).default(1),
  annual_increase_rate: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  next_increase_date: z.string().date().optional().nullable(),
  notes: z.string().optional().nullable(),
});
const updateProfileSchema = createProfileSchema.partial();

export const regularPaymentsRouter = Router();

regularPaymentsRouter.get('/regular-payments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(regularPaymentProfiles)
      .where(
        and(
          eq(regularPaymentProfiles.tenant_id, req.activeTenantId!),
          eq(regularPaymentProfiles.is_active, true),
        ),
      )
      .orderBy(desc(regularPaymentProfiles.created_at))
      .limit(200);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

regularPaymentsRouter.post('/regular-payments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createProfileSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(regularPaymentProfiles)
      .values({ tenant_id: req.activeTenantId!, ...body })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

regularPaymentsRouter.patch('/regular-payments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updateProfileSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(regularPaymentProfiles)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(regularPaymentProfiles.id, String(req.params.id ?? '')),
          eq(regularPaymentProfiles.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Sözleşme bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

regularPaymentsRouter.delete('/regular-payments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(regularPaymentProfiles)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(regularPaymentProfiles.id, String(req.params.id ?? '')),
          eq(regularPaymentProfiles.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Sözleşme bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// Sub-resource: periods listele
regularPaymentsRouter.get(
  '/regular-payments/:id/periods',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(regularPaymentPeriods)
        .where(
          and(
            eq(regularPaymentPeriods.profile_id, String(req.params.id ?? '')),
            eq(regularPaymentPeriods.tenant_id, req.activeTenantId!),
          ),
        )
        .orderBy(asc(regularPaymentPeriods.due_date));
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);
