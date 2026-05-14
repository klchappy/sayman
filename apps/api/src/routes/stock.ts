/**
 * /v1/stock — ERP'den çekilen stok bakiyesi (read-only).
 *
 *   GET /v1/stock                    → tüm stok kalemleri (filter: search, low_only)
 *   GET /v1/stock/critical           → kritik eşiğin altındakiler (kullanıcı tarafından set edilenler)
 *   PATCH /v1/stock/:id              → critical_threshold güncelle (manuel)
 */
import { and, asc, eq, ilike, isNotNull, lte, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, stockItems } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const stockRouter = Router();

stockRouter.get('/stock', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [eq(stockItems.tenant_id, req.activeTenantId!)];
    if (req.query.search) {
      const s = `%${String(req.query.search)}%`;
      conditions.push(or(ilike(stockItems.name, s), ilike(stockItems.code, s)));
    }
    if (String(req.query.low_only ?? '') === 'true') {
      conditions.push(isNotNull(stockItems.critical_threshold));
      conditions.push(sql`${stockItems.quantity}::numeric <= ${stockItems.critical_threshold}::numeric`);
    }

    const rows = await db
      .select()
      .from(stockItems)
      .where(and(...conditions))
      .orderBy(asc(stockItems.name))
      .limit(1000);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/stock/critical', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(stockItems)
      .where(
        and(
          eq(stockItems.tenant_id, req.activeTenantId!),
          isNotNull(stockItems.critical_threshold),
          sql`${stockItems.quantity}::numeric <= ${stockItems.critical_threshold}::numeric`,
        ),
      )
      .orderBy(asc(stockItems.quantity));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const thresholdSchema = z.object({
  critical_threshold: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null ? null : String(v))),
});

stockRouter.patch('/stock/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const { critical_threshold } = thresholdSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(stockItems)
      .set({ critical_threshold, updated_at: new Date() })
      .where(
        and(
          eq(stockItems.id, String(req.params.id ?? '')),
          eq(stockItems.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Stok kalemi bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
