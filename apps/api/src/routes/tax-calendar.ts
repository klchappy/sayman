/**
 * /v1/tax-calendar — Türk vergi takvimi (auto + manuel).
 *
 *   GET   /v1/tax-calendar?upcoming=true   → yaklaşan beyanname/ödemeler
 *   POST  /v1/tax-calendar                 → manuel event ekle (kullanıcı yarattığı)
 *   PATCH /v1/tax-calendar/:id             → status / estimated_amount güncelle
 *   POST  /v1/tax-calendar/:id/complete    → "ödendi/beyan edildi" işaretle
 *   POST  /v1/tax-calendar/regenerate      → cron'u manuel tetik (idempotent)
 */
import { and, asc, eq, gte } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, taxCalendarEvents } from '@sayman/db';
import { runGenerateTaxCalendar } from '../jobs/generate-tax-calendar';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

export const taxCalendarRouter = Router();

taxCalendarRouter.get('/tax-calendar', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const upcoming = String(req.query.upcoming ?? '') === 'true';
    const conditions: any[] = [
      tenantScope(req, taxCalendarEvents.tenant_id),
      eq(taxCalendarEvents.is_active, true),
    ];
    if (upcoming) {
      const today = new Date().toISOString().slice(0, 10);
      conditions.push(gte(taxCalendarEvents.due_date, today));
    }
    const where = and(...conditions);
    const rows = await db
      .select()
      .from(taxCalendarEvents)
      .where(where)
      .orderBy(asc(taxCalendarEvents.due_date))
      .limit(LIST_LIMITS.medium);
    const total = await countTotal(taxCalendarEvents, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.medium) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  kind: z.string().min(2).max(50),
  label: z.string().min(2).max(200),
  period: z.string().min(2).max(20),
  due_date: z.string().min(8),
  estimated_amount: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v == null ? null : String(v)))
    .optional(),
  notes: z.string().optional().nullable(),
});

taxCalendarRouter.post('/tax-calendar', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    try {
      const [row] = await db
        .insert(taxCalendarEvents)
        .values({
          tenant_id: req.activeTenantId!,
          kind: body.kind,
          label: body.label,
          period: body.period,
          due_date: body.due_date,
          estimated_amount: body.estimated_amount ?? null,
          notes: body.notes ?? null,
        })
        .returning();
      res.status(201).json({ data: row });
    } catch (err) {
      if ((err as Error).message.includes('uq_tax_calendar_kind_period')) {
        throw new HttpError(409, 'Bu kind + period zaten kayıtlı');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  status: z.enum(['pending', 'submitted', 'paid', 'late', 'cancelled']).optional(),
  estimated_amount: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v == null ? null : String(v)))
    .optional(),
  notes: z.string().optional().nullable(),
});

taxCalendarRouter.patch(
  '/tax-calendar/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchSchema.parse(req.body);
      const db = getDb();
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.status) patch.status = body.status;
      if (body.estimated_amount !== undefined) patch.estimated_amount = body.estimated_amount;
      if (body.notes !== undefined) patch.notes = body.notes;

      const [row] = await db
        .update(taxCalendarEvents)
        .set(patch)
        .where(
          and(
            eq(taxCalendarEvents.id, String(req.params.id ?? '')),
            eq(taxCalendarEvents.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Tax event bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

taxCalendarRouter.post(
  '/tax-calendar/:id/complete',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(taxCalendarEvents)
        .set({ status: 'paid', completed_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(taxCalendarEvents.id, String(req.params.id ?? '')),
            eq(taxCalendarEvents.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Tax event bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

taxCalendarRouter.post(
  '/tax-calendar/regenerate',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok');
      }
      const result = await runGenerateTaxCalendar();
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
