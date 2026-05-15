/**
 * /v1/subscriptions — Abonelik & Taahhüt CRUD.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, subscriptions } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const createSchema = z.object({
  institution_id: z.string().uuid().optional().nullable(),
  owner_type: z.enum(['company', 'person', 'family', 'other']).default('company'),
  company_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
  subscription_no: z.string().optional().nullable(),
  package_name: z.string().optional().nullable(),
  auto_payment: z.boolean().default(false),
  monthly_amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  currency: z.string().length(3).default('TRY'),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  commitment_end_date: z.string().date().optional().nullable(),
  cancellation_penalty: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  status: z.enum(['active', 'on_hold', 'cancelled', 'expired']).default('active'),
  notes: z.string().optional().nullable(),
});
const updateSchema = createSchema.partial();

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/subscriptions', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.tenant_id, req.activeTenantId!), eq(subscriptions.is_active, true)))
      .orderBy(desc(subscriptions.commitment_end_date), desc(subscriptions.created_at))
      .limit(200);
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.post('/subscriptions', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(subscriptions)
      .values({ tenant_id: req.activeTenantId!, ...body })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.patch('/subscriptions/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(subscriptions)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(subscriptions.id, String(req.params.id ?? '')),
          eq(subscriptions.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Abonelik bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.delete('/subscriptions/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(subscriptions)
      .set({ is_active: false, status: 'cancelled', updated_at: new Date() })
      .where(
        and(
          eq(subscriptions.id, String(req.params.id ?? '')),
          eq(subscriptions.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Abonelik bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
