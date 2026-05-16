/**
 * /v1/reports/consolidated/* — Tüm tenant'lar için konsolide raporlar.
 *
 * Admin "Tüm Şirketler" görünümünde:
 *   GET /v1/reports/consolidated/profit-loss?from=YYYY-MM-DD&to=YYYY-MM-DD
 *     → org-wide P&L + per-tenant breakdown
 *   GET /v1/reports/consolidated/balance-sheet?as_of=YYYY-MM-DD
 *     → org-wide bilanço + per-tenant breakdown
 *
 * Auth: super_admin / organization_admin / yonetici
 * Tenant kapsamı: `requireTenantOrAggregate` middleware ile
 *   - Aggregate mode: tüm org tenant'ları (deny override'lar hariç)
 *   - Tek tenant: sadece o tenant (per-tenant breakdown'da kendisi)
 */
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '@sayman/db';
import { HttpError, requireTenantOrAggregate } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reportsConsolidatedRouter = Router();

const CONSOLIDATED_ROLES = new Set([
  'super_admin',
  'organization_admin',
  'yonetici',
  'muhasebeci',
]);

/**
 * GET /v1/reports/consolidated/profit-loss
 *   Konsolide gelir/gider — per-tenant breakdown + grand total.
 */
reportsConsolidatedRouter.get(
  '/reports/consolidated/profit-loss',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      if (!CONSOLIDATED_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Konsolide rapor yetkisi yok', 'FORBIDDEN');
      }
      const from = String(req.query.from ?? '');
      const to = String(req.query.to ?? '');
      if (!from || !to) {
        throw new HttpError(400, 'from + to query zorunlu (YYYY-MM-DD)');
      }

      const db = getDb();
      // Aggregate ise tüm tenant'lar, tek tenant ise sadece o
      const tenantIds = req.aggregateTenantIds ?? [req.activeTenantId!];

      // Per-tenant breakdown
      const perTenant = await db.execute(sql`
        SELECT
          t.id AS tenant_id,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          COALESCE(rev.total, 0) AS revenue,
          COALESCE(exp.total, 0) AS expenses,
          COALESCE(dep.total, 0) AS depreciation,
          COALESCE(rev.total, 0) - COALESCE(exp.total, 0) AS gross_profit,
          COALESCE(rev.total, 0) - COALESCE(exp.total, 0) - COALESCE(dep.total, 0) AS net_profit
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount::numeric), 0) AS total
          FROM sales_invoices
          WHERE tenant_id = t.id
            AND is_active = true
            AND status != 'cancelled'
            AND needs_review = false
            AND issue_date BETWEEN ${from} AND ${to}
        ) rev ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount::numeric), 0) AS total
          FROM payable_items
          WHERE tenant_id = t.id
            AND is_active = true
            AND needs_review = false
            AND issue_date BETWEEN ${from} AND ${to}
        ) exp ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount::numeric), 0) AS total
          FROM depreciation_entries
          WHERE tenant_id = t.id
            AND period BETWEEN ${from} AND ${to}
        ) dep ON true
        WHERE t.id = ANY(${tenantIds}::uuid[])
        ORDER BY t.name ASC
      `);

      const perTenantRows = (perTenant.rows ?? perTenant) as Array<{
        tenant_id: string;
        tenant_slug: string;
        tenant_name: string;
        revenue: string | number;
        expenses: string | number;
        depreciation: string | number;
        gross_profit: string | number;
        net_profit: string | number;
      }>;

      // Aylık trend (tüm tenant'lar birlikte)
      const monthlyTrend = await db.execute(sql`
        WITH months AS (
          SELECT to_char(issue_date, 'YYYY-MM') AS ym, SUM(amount::numeric) AS revenue, 0 AS expenses
          FROM sales_invoices
          WHERE tenant_id = ANY(${tenantIds}::uuid[])
            AND is_active = true
            AND status != 'cancelled'
            AND needs_review = false
            AND issue_date BETWEEN ${from} AND ${to}
          GROUP BY ym
          UNION ALL
          SELECT to_char(issue_date, 'YYYY-MM') AS ym, 0 AS revenue, SUM(amount::numeric) AS expenses
          FROM payable_items
          WHERE tenant_id = ANY(${tenantIds}::uuid[])
            AND is_active = true
            AND needs_review = false
            AND issue_date BETWEEN ${from} AND ${to}
          GROUP BY ym
        )
        SELECT ym, SUM(revenue) AS revenue, SUM(expenses) AS expenses
        FROM months
        GROUP BY ym
        ORDER BY ym ASC
      `);

      // Kategori bazlı top giderler (konsolide)
      const expensesByCategory = await db.execute(sql`
        SELECT
          COALESCE(category, 'belirsiz') AS category,
          COUNT(*) AS count,
          SUM(amount::numeric) AS total
        FROM payable_items
        WHERE tenant_id = ANY(${tenantIds}::uuid[])
          AND is_active = true
          AND needs_review = false
          AND issue_date BETWEEN ${from} AND ${to}
        GROUP BY category
        ORDER BY total DESC
        LIMIT 15
      `);

      // Grand total
      const grand = perTenantRows.reduce(
        (acc, t) => ({
          revenue: acc.revenue + Number(t.revenue),
          expenses: acc.expenses + Number(t.expenses),
          depreciation: acc.depreciation + Number(t.depreciation),
          gross_profit: acc.gross_profit + Number(t.gross_profit),
          net_profit: acc.net_profit + Number(t.net_profit),
        }),
        { revenue: 0, expenses: 0, depreciation: 0, gross_profit: 0, net_profit: 0 },
      );

      res.json({
        data: {
          period: { from, to },
          tenant_count: perTenantRows.length,
          grand_total: {
            ...grand,
            margin_pct: grand.revenue > 0 ? (grand.net_profit / grand.revenue) * 100 : 0,
          },
          by_tenant: perTenantRows.map((t) => ({
            tenant_id: t.tenant_id,
            tenant_slug: t.tenant_slug,
            tenant_name: t.tenant_name,
            revenue: Number(t.revenue),
            expenses: Number(t.expenses),
            depreciation: Number(t.depreciation),
            gross_profit: Number(t.gross_profit),
            net_profit: Number(t.net_profit),
            margin_pct:
              Number(t.revenue) > 0
                ? (Number(t.net_profit) / Number(t.revenue)) * 100
                : 0,
          })),
          by_month: ((monthlyTrend.rows ?? monthlyTrend) as Array<Record<string, unknown>>).map(
            (r) => ({
              ym: String(r.ym),
              revenue: Number(r.revenue),
              expenses: Number(r.expenses),
              profit: Number(r.revenue) - Number(r.expenses),
            }),
          ),
          by_category: ((expensesByCategory.rows ?? expensesByCategory) as Array<Record<string, unknown>>).map(
            (r) => ({
              category: String(r.category),
              count: Number(r.count),
              total: Number(r.total),
            }),
          ),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /v1/reports/consolidated/balance-sheet?as_of=YYYY-MM-DD
 *   Konsolide bilanço snapshot.
 *
 * Basit hesaplama:
 *   Active (Varlıklar)  = fixed_assets.purchase_cost - accumulated_depreciation
 *                       + sales_invoices.outstanding (alacaklar)
 *   Passive (Borçlar)  = payable_items.outstanding (ödenmesi gerekenler)
 *   Equity (Özsermaye) = Active - Passive
 */
reportsConsolidatedRouter.get(
  '/reports/consolidated/balance-sheet',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      if (!CONSOLIDATED_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Konsolide rapor yetkisi yok', 'FORBIDDEN');
      }
      const asOf = String(req.query.as_of ?? new Date().toISOString().slice(0, 10));

      const db = getDb();
      const tenantIds = req.aggregateTenantIds ?? [req.activeTenantId!];

      const perTenant = await db.execute(sql`
        SELECT
          t.id AS tenant_id,
          t.slug AS tenant_slug,
          t.name AS tenant_name,
          COALESCE(fa.net_value, 0) AS fixed_assets_net,
          COALESCE(ar.outstanding, 0) AS receivables,
          COALESCE(ap.outstanding, 0) AS payables
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(purchase_cost::numeric - accumulated_depreciation::numeric), 0) AS net_value
          FROM fixed_assets
          WHERE tenant_id = t.id
            AND is_active = true
            AND status = 'active'
        ) fa ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount::numeric - paid_amount::numeric), 0) AS outstanding
          FROM sales_invoices
          WHERE tenant_id = t.id
            AND is_active = true
            AND status NOT IN ('paid', 'cancelled')
            AND needs_review = false
            AND (issue_date IS NULL OR issue_date <= ${asOf})
        ) ar ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount::numeric - paid_amount::numeric), 0) AS outstanding
          FROM payable_items
          WHERE tenant_id = t.id
            AND is_active = true
            AND status NOT IN ('paid', 'cancelled')
            AND needs_review = false
            AND (issue_date IS NULL OR issue_date <= ${asOf})
        ) ap ON true
        WHERE t.id = ANY(${tenantIds}::uuid[])
        ORDER BY t.name ASC
      `);

      const rows = (perTenant.rows ?? perTenant) as Array<{
        tenant_id: string;
        tenant_slug: string;
        tenant_name: string;
        fixed_assets_net: string | number;
        receivables: string | number;
        payables: string | number;
      }>;

      const formatted = rows.map((t) => {
        const fixedAssetsNet = Number(t.fixed_assets_net);
        const receivables = Number(t.receivables);
        const payables = Number(t.payables);
        const totalAssets = fixedAssetsNet + receivables;
        const totalLiabilities = payables;
        const equity = totalAssets - totalLiabilities;
        return {
          tenant_id: t.tenant_id,
          tenant_slug: t.tenant_slug,
          tenant_name: t.tenant_name,
          fixed_assets_net: fixedAssetsNet,
          receivables,
          payables,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          equity,
        };
      });

      const grand = formatted.reduce(
        (acc, t) => ({
          fixed_assets_net: acc.fixed_assets_net + t.fixed_assets_net,
          receivables: acc.receivables + t.receivables,
          payables: acc.payables + t.payables,
          total_assets: acc.total_assets + t.total_assets,
          total_liabilities: acc.total_liabilities + t.total_liabilities,
          equity: acc.equity + t.equity,
        }),
        {
          fixed_assets_net: 0,
          receivables: 0,
          payables: 0,
          total_assets: 0,
          total_liabilities: 0,
          equity: 0,
        },
      );

      res.json({
        data: {
          as_of: asOf,
          tenant_count: formatted.length,
          grand_total: grand,
          by_tenant: formatted,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
