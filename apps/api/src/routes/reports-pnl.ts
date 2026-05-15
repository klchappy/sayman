/**
 * /v1/reports/profit-loss — Gelir/Gider tablosu (P&L).
 *
 *   GET /v1/reports/profit-loss?from=2026-01-01&to=2026-12-31
 *
 * Response yapısı:
 *   revenue: { total, by_category: [], by_month: [] }     ← sales_invoices
 *   expenses: { total, by_category: [], by_month: [] }    ← payable_items
 *   depreciation: { total, by_month: [] }                 ← depreciation_entries
 *   gross_profit = revenue - expenses
 *   net_profit = gross_profit - depreciation
 *   margin_pct = net_profit / revenue * 100
 */
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '@sayman/db';
import { CATEGORY_LABELS, type PayableCategory } from '@sayman/shared';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reportsPnlRouter = Router();

reportsPnlRouter.get(
  '/reports/profit-loss',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const from = String(req.query.from ?? '');
      const to = String(req.query.to ?? '');
      if (!from || !to) throw new HttpError(400, 'from + to query zorunlu');

      const db = getDb();
      const tid = req.activeTenantId!;

      // Revenue: sales_invoices amount toplamı (issue_date'e göre)
      const revenueAgg = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount::numeric), 0) AS total,
          COUNT(*) AS invoice_count
        FROM sales_invoices
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND status != 'cancelled'
          AND issue_date BETWEEN ${from} AND ${to}
      `);
      const revenue = ((revenueAgg.rows ?? revenueAgg) as Array<Record<string, unknown>>)[0] ?? {};

      const revenueByMonth = await db.execute(sql`
        SELECT
          to_char(issue_date, 'YYYY-MM') AS ym,
          COALESCE(SUM(amount::numeric), 0) AS total
        FROM sales_invoices
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND status != 'cancelled'
          AND issue_date BETWEEN ${from} AND ${to}
        GROUP BY ym
        ORDER BY ym ASC
      `);

      // Expenses: payable_items
      const expensesAgg = await db.execute(sql`
        SELECT
          COALESCE(SUM(amount::numeric), 0) AS total,
          COUNT(*) AS invoice_count
        FROM payable_items
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND issue_date BETWEEN ${from} AND ${to}
      `);
      const expenses = ((expensesAgg.rows ?? expensesAgg) as Array<Record<string, unknown>>)[0] ?? {};

      const expensesByCategory = await db.execute(sql`
        SELECT
          COALESCE(category, 'belirsiz') AS category,
          COUNT(*) AS count,
          SUM(amount::numeric) AS total
        FROM payable_items
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND issue_date BETWEEN ${from} AND ${to}
        GROUP BY category
        ORDER BY total DESC
      `);

      const expensesByMonth = await db.execute(sql`
        SELECT
          to_char(issue_date, 'YYYY-MM') AS ym,
          COALESCE(SUM(amount::numeric), 0) AS total
        FROM payable_items
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND issue_date BETWEEN ${from} AND ${to}
        GROUP BY ym
        ORDER BY ym ASC
      `);

      // Amortisman
      const depAgg = await db.execute(sql`
        SELECT
          COALESCE(SUM(depreciation_amount::numeric), 0) AS total
        FROM depreciation_entries
        WHERE tenant_id = ${tid}::uuid
          AND period >= to_char(${from}::date, 'YYYY-MM')
          AND period <= to_char(${to}::date, 'YYYY-MM')
      `);
      const depRow = ((depAgg.rows ?? depAgg) as Array<Record<string, unknown>>)[0] ?? {};
      const depTotal = Number(depRow.total ?? 0);

      const depByMonth = await db.execute(sql`
        SELECT
          period AS ym,
          SUM(depreciation_amount::numeric) AS total
        FROM depreciation_entries
        WHERE tenant_id = ${tid}::uuid
          AND period >= to_char(${from}::date, 'YYYY-MM')
          AND period <= to_char(${to}::date, 'YYYY-MM')
        GROUP BY period
        ORDER BY period ASC
      `);

      const revenueTotal = Number(revenue.total ?? 0);
      const expensesTotal = Number(expenses.total ?? 0);
      const grossProfit = revenueTotal - expensesTotal;
      const netProfit = grossProfit - depTotal;
      const marginPct = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : 0;

      res.json({
        data: {
          period: { from, to },
          revenue: {
            total: revenueTotal,
            invoice_count: Number(revenue.invoice_count ?? 0),
            by_month: ((revenueByMonth.rows ?? revenueByMonth) as Array<Record<string, unknown>>).map(
              (r) => ({ ym: String(r.ym), total: Number(r.total) }),
            ),
          },
          expenses: {
            total: expensesTotal,
            invoice_count: Number(expenses.invoice_count ?? 0),
            by_category: ((expensesByCategory.rows ?? expensesByCategory) as Array<Record<string, unknown>>)
              .map((r) => ({
                category: String(r.category),
                category_label:
                  CATEGORY_LABELS[String(r.category) as PayableCategory] ?? String(r.category),
                count: Number(r.count),
                total: Number(r.total),
              })),
            by_month: ((expensesByMonth.rows ?? expensesByMonth) as Array<Record<string, unknown>>).map(
              (r) => ({ ym: String(r.ym), total: Number(r.total) }),
            ),
          },
          depreciation: {
            total: depTotal,
            by_month: ((depByMonth.rows ?? depByMonth) as Array<Record<string, unknown>>).map((r) => ({
              ym: String(r.ym),
              total: Number(r.total),
            })),
          },
          gross_profit: grossProfit,
          net_profit: netProfit,
          margin_pct: Math.round(marginPct * 10) / 10,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
