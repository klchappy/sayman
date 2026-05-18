/**
 * /v1/similar/payable/:id — benzer fatura kayıtları.
 *
 * Algorithm (metadata-based scoring, pgvector öncesi MVP):
 *   - Aynı supplier_name veya company_id: +5
 *   - Aynı category: +3
 *   - Aynı period_label: +2
 *   - Amount yakın (±20%): +2
 *   - Aynı invoice_number prefix (-3 hane): +1
 *   - Created_at yakın (90 gün): +1
 *
 * Top 10 score, kendisi hariç.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, payableItems } from '@sayman/db';
import { HttpError, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { uuidArray } from '../lib/sql-utils';
import { requireAuth } from '../middleware/auth';

export const similarRouter = Router();

similarRouter.get('/similar/payable/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [target] = await db
      .select()
      .from(payableItems)
      .where(
        and(
          eq(payableItems.id, String(req.params.id ?? '')),
          tenantScope(req, payableItems.tenant_id),
        ),
      );
    if (!target) throw new HttpError(404, 'Fatura bulunamadı', 'NOT_FOUND');

    const amount = Number(target.amount);
    const amountLow = (amount * 0.8).toFixed(2);
    const amountHigh = (amount * 1.2).toFixed(2);

    // Aggregate-aware tenant filter for raw SQL: tek tenant tek id, aggregate çoklu liste
    const tenantFilter = req.aggregateTenantIds
      ? sql`p.tenant_id = ANY(${uuidArray(req.aggregateTenantIds)})`
      : sql`p.tenant_id = ${req.activeTenantId!}::uuid`;

    // Scored similar query
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.title,
        p.supplier_name,
        p.amount,
        p.due_date,
        p.status,
        p.invoice_number,
        p.category,
        p.created_at,
        (
          CASE WHEN p.supplier_name IS NOT DISTINCT FROM ${target.supplier_name} AND p.supplier_name IS NOT NULL THEN 5 ELSE 0 END +
          CASE WHEN p.company_id IS NOT DISTINCT FROM ${target.company_id} AND p.company_id IS NOT NULL THEN 5 ELSE 0 END +
          CASE WHEN p.category IS NOT DISTINCT FROM ${target.category} AND p.category IS NOT NULL THEN 3 ELSE 0 END +
          CASE WHEN p.period_label IS NOT DISTINCT FROM ${target.period_label} AND p.period_label IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN p.amount::numeric BETWEEN ${amountLow}::numeric AND ${amountHigh}::numeric THEN 2 ELSE 0 END +
          CASE WHEN p.created_at > NOW() - INTERVAL '90 days' THEN 1 ELSE 0 END
        ) AS score
      FROM payable_items p
      WHERE ${tenantFilter}
        AND p.id <> ${target.id}::uuid
        AND p.is_active = true
      ORDER BY score DESC, p.created_at DESC
      LIMIT 10
    `);
    const list = ((rows.rows ?? rows) as Array<Record<string, unknown>>).filter(
      (r) => Number(r.score) > 0,
    );
    res.json({
      data: list.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        supplier_name: r.supplier_name ? String(r.supplier_name) : null,
        amount: String(r.amount),
        due_date: r.due_date as string | null,
        status: String(r.status),
        invoice_number: r.invoice_number as string | null,
        category: r.category as string | null,
        score: Number(r.score),
      })),
    });
  } catch (err) {
    next(err);
  }
});
