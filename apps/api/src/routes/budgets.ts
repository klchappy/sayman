/**
 * /v1/budgets — Kategori bazlı aylık/quarterly/yıllık bütçe planlama.
 *
 *   GET    /v1/budgets?period=2026-05      → o dönemin bütçeleri + gerçekleşen
 *   POST   /v1/budgets                     → yeni bütçe
 *   PATCH  /v1/budgets/:id                 → planned_amount, threshold güncelle
 *   DELETE /v1/budgets/:id                 → soft delete
 *   GET    /v1/budgets/comparison          → tüm aktif dönem karşılaştırma
 *
 * Gerçekleşen tutar: payable_items.amount toplamı, period ve kategoriye göre.
 * "Bu ay elektrik 5000 planladı, 4200 harcadı, %84 kullanım" gibi.
 */
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { budgets, getDb, payableItems } from '@sayman/db';
import { CATEGORY_LABELS, type PayableCategory } from '@sayman/shared';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const budgetsRouter = Router();

/** Period → tarih aralığı (created_at filter için) */
function periodToRange(period: string, kind: string): { from: string; to: string } | null {
  if (kind === 'monthly') {
    // 2026-05
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const from = `${y}-${String(mm).padStart(2, '0')}-01`;
    const last = new Date(y, mm, 0).getDate();
    const to = `${y}-${String(mm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
  }
  if (kind === 'quarterly') {
    // 2026-Q2
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    const y = Number(m[1]);
    const q = Number(m[2]);
    const mStart = (q - 1) * 3 + 1;
    const mEnd = q * 3;
    const lastDay = new Date(y, mEnd, 0).getDate();
    return {
      from: `${y}-${String(mStart).padStart(2, '0')}-01`,
      to: `${y}-${String(mEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (kind === 'yearly') {
    const y = Number(period);
    if (isNaN(y)) return null;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return null;
}

async function computeActual(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  category: string,
  from: string,
  to: string,
): Promise<number> {
  const [r] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric), 0)`,
    })
    .from(payableItems)
    .where(
      and(
        eq(payableItems.tenant_id, tenantId),
        eq(payableItems.is_active, true),
        eq(payableItems.category, category),
        gte(payableItems.issue_date, from),
        lte(payableItems.issue_date, to),
      ),
    );
  return Number(r?.total ?? 0);
}

budgetsRouter.get('/budgets', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const period = req.query.period ? String(req.query.period) : null;
    const db = getDb();
    const conditions: any[] = [
      eq(budgets.tenant_id, req.activeTenantId!),
      eq(budgets.is_active, true),
    ];
    if (period) conditions.push(eq(budgets.period, period));

    const rows = await db
      .select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(desc(budgets.period), budgets.category);

    // Her bütçe için gerçekleşen tutarı hesapla
    const enriched = [];
    for (const b of rows) {
      const range = periodToRange(b.period, b.period_kind);
      const actual = range
        ? await computeActual(db, req.activeTenantId!, b.category, range.from, range.to)
        : 0;
      const planned = Number(b.planned_amount);
      const usagePct = planned > 0 ? (actual / planned) * 100 : 0;
      enriched.push({
        ...b,
        actual_amount: actual,
        usage_pct: Math.round(usagePct * 10) / 10,
        over_budget: actual > planned,
        category_label: CATEGORY_LABELS[b.category as PayableCategory] ?? b.category,
      });
    }

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  category: z.string().min(2).max(64),
  period_kind: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  period: z.string().min(2).max(20),
  planned_amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  alert_threshold_pct: z.number().min(0).max(200).default(80).optional(),
  notes: z.string().max(500).optional().nullable(),
});

budgetsRouter.post('/budgets', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    try {
      const [row] = await db
        .insert(budgets)
        .values({
          tenant_id: req.activeTenantId!,
          category: body.category,
          period_kind: body.period_kind,
          period: body.period,
          planned_amount: body.planned_amount,
          currency: body.currency,
          alert_threshold_pct: String(body.alert_threshold_pct ?? 80),
          notes: body.notes ?? null,
          created_by: req.authUser?.id ?? null,
        })
        .returning();
      res.status(201).json({ data: row });
    } catch (err) {
      if ((err as Error).message.includes('uq_budgets')) {
        throw new HttpError(409, 'Bu kategori + dönem için zaten bütçe var');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  planned_amount: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  alert_threshold_pct: z.number().min(0).max(200).optional(),
  notes: z.string().optional().nullable(),
});

budgetsRouter.patch('/budgets/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const db = getDb();
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.planned_amount != null) patch.planned_amount = body.planned_amount;
    if (body.alert_threshold_pct != null)
      patch.alert_threshold_pct = String(body.alert_threshold_pct);
    if (body.notes !== undefined) patch.notes = body.notes;

    const [row] = await db
      .update(budgets)
      .set(patch)
      .where(
        and(
          eq(budgets.id, String(req.params.id ?? '')),
          eq(budgets.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Bütçe bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.delete('/budgets/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(budgets)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(budgets.id, String(req.params.id ?? '')),
          eq(budgets.tenant_id, req.activeTenantId!),
        ),
      )
      .returning({ id: budgets.id });
    if (!row) throw new HttpError(404, 'Bütçe bulunamadı');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Bu ay + bir önceki ay karşılaştırma — dashboard widget için */
budgetsRouter.get(
  '/budgets/comparison',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const rows = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.tenant_id, req.activeTenantId!),
            eq(budgets.is_active, true),
            eq(budgets.period, currentPeriod),
          ),
        );

      const result = [];
      for (const b of rows) {
        const range = periodToRange(b.period, b.period_kind);
        if (!range) continue;
        const actual = await computeActual(
          db,
          req.activeTenantId!,
          b.category,
          range.from,
          range.to,
        );
        const planned = Number(b.planned_amount);
        result.push({
          id: b.id,
          category: b.category,
          category_label: CATEGORY_LABELS[b.category as PayableCategory] ?? b.category,
          planned,
          actual,
          usage_pct: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
          over_budget: actual > planned,
        });
      }

      result.sort((a, b) => b.usage_pct - a.usage_pct);
      res.json({ data: { period: currentPeriod, items: result } });
    } catch (err) {
      next(err);
    }
  },
);
