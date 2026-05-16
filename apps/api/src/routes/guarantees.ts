/**
 * /v1/guarantees — Teminat mektupları + komisyon periodları.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, guaranteeCommissionPeriods, guarantees } from '@sayman/db';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

const createSchema = z.object({
  bank_id: z.string().uuid().optional().nullable(),
  issuer_company_id: z.string().uuid().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
  beneficiary_name: z.string().min(2).max(255),
  letter_no: z.string().optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  currency: z.string().length(3).default('TRY'),
  issue_date: z.string().date().optional().nullable(),
  expiry_date: z.string().date().optional().nullable(),
  commission_rate: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional().nullable(),
  commission_frequency_months: z.number().int().min(1).max(12).default(3),
  status: z.enum(['active', 'returned', 'expired', 'cancelled']).default('active'),
  notes: z.string().optional().nullable(),
});
const updateSchema = createSchema.partial().extend({
  returned_at: z.string().date().optional().nullable(),
});

export const guaranteesRouter = Router();

guaranteesRouter.get('/guarantees', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const where = and(
      tenantScope(req, guarantees.tenant_id),
      eq(guarantees.is_active, true),
    );
    const rows = await db
      .select()
      .from(guarantees)
      .where(where)
      .orderBy(desc(guarantees.expiry_date), desc(guarantees.created_at))
      .limit(LIST_LIMITS.medium);
    const total = await countTotal(guarantees, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.medium) });
  } catch (err) {
    next(err);
  }
});

guaranteesRouter.post('/guarantees', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(guarantees)
      .values({ tenant_id: req.activeTenantId!, ...body })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

guaranteesRouter.patch('/guarantees/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(guarantees)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(guarantees.id, String(req.params.id ?? '')),
          eq(guarantees.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Teminat bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

guaranteesRouter.delete('/guarantees/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(guarantees)
      .set({ is_active: false, status: 'cancelled', updated_at: new Date() })
      .where(
        and(
          eq(guarantees.id, String(req.params.id ?? '')),
          eq(guarantees.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Teminat bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

guaranteesRouter.get(
  '/guarantees/:id/commission-periods',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(guaranteeCommissionPeriods)
        .where(
          and(
            eq(guaranteeCommissionPeriods.guarantee_id, String(req.params.id ?? '')),
            eq(guaranteeCommissionPeriods.tenant_id, req.activeTenantId!),
          ),
        )
        .orderBy(asc(guaranteeCommissionPeriods.due_date));
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);
