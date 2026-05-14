/**
 * /v1/suppliers/scorecard — Tedarikçi performans karnesi.
 *
 *   GET /v1/suppliers/scorecard         → tüm tedarikçilerin sıralı listesi
 *   GET /v1/suppliers/:name/scorecard   → tek tedarikçinin detayı
 *
 * Metrikler:
 *   - total_volume: toplam fatura tutarı
 *   - avg_amount: ortalama fatura tutarı
 *   - paid_on_time_pct: vadesinde ödenen yüzde
 *   - avg_payment_delay_days: ortalama gecikme (negatif = erken)
 *   - last_invoice: son fatura tarihi
 *   - category_distribution: kategori dağılımı
 *   - status_breakdown: bekleyen/gecikmiş/ödenmiş sayıları
 */
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const supplierScorecardRouter = Router();

supplierScorecardRouter.get(
  '/suppliers/scorecard',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

      const db = getDb();
      const rows = await db.execute(sql`
        WITH delays AS (
          SELECT
            pi.supplier_name,
            pi.id,
            pi.amount,
            pi.due_date,
            pi.status,
            pi.category,
            pi.created_at,
            EXTRACT(EPOCH FROM (
              COALESCE(
                (SELECT MAX(paid_at) FROM payment_transactions
                  WHERE payable_id = pi.id AND is_active = true),
                NOW()
              ) - pi.due_date::timestamp
            )) / 86400 AS delay_days
          FROM payable_items pi
          WHERE pi.tenant_id = ${tenantId}::uuid
            AND pi.is_active = true
            AND pi.supplier_name IS NOT NULL
            AND pi.supplier_name != ''
        )
        SELECT
          supplier_name,
          COUNT(*) AS invoice_count,
          COALESCE(SUM(amount::numeric), 0) AS total_volume,
          COALESCE(AVG(amount::numeric), 0) AS avg_amount,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
          COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
          COUNT(*) FILTER (WHERE status IN ('pending', 'approaching')) AS pending_count,
          COALESCE(
            AVG(delay_days) FILTER (WHERE status = 'paid'),
            0
          ) AS avg_payment_delay_days,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'paid' AND delay_days <= 0) /
            NULLIF(COUNT(*) FILTER (WHERE status = 'paid'), 0),
            1
          ) AS paid_on_time_pct,
          MAX(created_at) AS last_invoice_at,
          MIN(created_at) AS first_invoice_at
        FROM delays
        GROUP BY supplier_name
        ORDER BY total_volume DESC
        LIMIT 200
      `);

      const list = (rows.rows ?? rows) as Array<Record<string, unknown>>;
      res.json({
        data: list.map((r) => ({
          supplier_name: String(r.supplier_name),
          invoice_count: Number(r.invoice_count ?? 0),
          total_volume: Number(r.total_volume ?? 0),
          avg_amount: Number(r.avg_amount ?? 0),
          paid_count: Number(r.paid_count ?? 0),
          overdue_count: Number(r.overdue_count ?? 0),
          pending_count: Number(r.pending_count ?? 0),
          avg_payment_delay_days: Math.round(Number(r.avg_payment_delay_days ?? 0) * 10) / 10,
          paid_on_time_pct: r.paid_on_time_pct == null ? null : Number(r.paid_on_time_pct),
          last_invoice_at: r.last_invoice_at,
          first_invoice_at: r.first_invoice_at,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

supplierScorecardRouter.get(
  '/suppliers/:name/scorecard',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');
      const name = String(req.params.name ?? '');
      if (!name) throw new HttpError(400, 'Tedarikçi adı zorunlu');

      const db = getDb();

      // KPI özet
      const summary = await db.execute(sql`
        WITH delays AS (
          SELECT
            pi.id,
            pi.amount,
            pi.due_date,
            pi.status,
            pi.category,
            pi.created_at,
            EXTRACT(EPOCH FROM (
              COALESCE(
                (SELECT MAX(paid_at) FROM payment_transactions
                  WHERE payable_id = pi.id AND is_active = true),
                NOW()
              ) - pi.due_date::timestamp
            )) / 86400 AS delay_days
          FROM payable_items pi
          WHERE pi.tenant_id = ${tenantId}::uuid
            AND pi.supplier_name = ${name}
            AND pi.is_active = true
        )
        SELECT
          COUNT(*) AS invoice_count,
          COALESCE(SUM(amount::numeric), 0) AS total_volume,
          COALESCE(AVG(amount::numeric), 0) AS avg_amount,
          COALESCE(MIN(amount::numeric), 0) AS min_amount,
          COALESCE(MAX(amount::numeric), 0) AS max_amount,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
          COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
          COALESCE(
            AVG(delay_days) FILTER (WHERE status = 'paid'),
            0
          ) AS avg_payment_delay_days,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'paid' AND delay_days <= 0) /
            NULLIF(COUNT(*) FILTER (WHERE status = 'paid'), 0),
            1
          ) AS paid_on_time_pct
        FROM delays
      `);

      // Aylık trend (son 12 ay)
      const monthlyTrend = await db.execute(sql`
        WITH months AS (
          SELECT to_char(date_trunc('month', NOW()) - (n || ' months')::interval, 'YYYY-MM') AS ym
          FROM generate_series(0, 11) AS n
        )
        SELECT
          m.ym,
          COALESCE(COUNT(pi.id), 0) AS count,
          COALESCE(SUM(pi.amount::numeric), 0) AS total
        FROM months m
        LEFT JOIN payable_items pi ON to_char(pi.created_at, 'YYYY-MM') = m.ym
          AND pi.tenant_id = ${tenantId}::uuid
          AND pi.supplier_name = ${name}
          AND pi.is_active = true
        GROUP BY m.ym
        ORDER BY m.ym ASC
      `);

      // Kategori dağılımı
      const categoryDist = await db.execute(sql`
        SELECT
          COALESCE(category, 'belirsiz') AS category,
          COUNT(*) AS count,
          SUM(amount::numeric) AS total
        FROM payable_items
        WHERE tenant_id = ${tenantId}::uuid
          AND supplier_name = ${name}
          AND is_active = true
        GROUP BY category
        ORDER BY count DESC
      `);

      // Son 10 fatura
      const recent = await db.execute(sql`
        SELECT id, title, amount, due_date, status, category, created_at
        FROM payable_items
        WHERE tenant_id = ${tenantId}::uuid
          AND supplier_name = ${name}
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 10
      `);

      const summaryRow = ((summary.rows ?? summary) as Array<Record<string, unknown>>)[0] ?? {};

      res.json({
        data: {
          supplier_name: name,
          summary: {
            invoice_count: Number(summaryRow.invoice_count ?? 0),
            total_volume: Number(summaryRow.total_volume ?? 0),
            avg_amount: Number(summaryRow.avg_amount ?? 0),
            min_amount: Number(summaryRow.min_amount ?? 0),
            max_amount: Number(summaryRow.max_amount ?? 0),
            paid_count: Number(summaryRow.paid_count ?? 0),
            overdue_count: Number(summaryRow.overdue_count ?? 0),
            avg_payment_delay_days:
              Math.round(Number(summaryRow.avg_payment_delay_days ?? 0) * 10) / 10,
            paid_on_time_pct:
              summaryRow.paid_on_time_pct == null ? null : Number(summaryRow.paid_on_time_pct),
          },
          monthly_trend: ((monthlyTrend.rows ?? monthlyTrend) as Array<Record<string, unknown>>).map(
            (r) => ({
              ym: String(r.ym),
              count: Number(r.count ?? 0),
              total: Number(r.total ?? 0),
            }),
          ),
          category_distribution: ((categoryDist.rows ?? categoryDist) as Array<
            Record<string, unknown>
          >).map((r) => ({
            category: String(r.category),
            count: Number(r.count ?? 0),
            total: Number(r.total ?? 0),
          })),
          recent_payables: ((recent.rows ?? recent) as Array<Record<string, unknown>>).map((r) => ({
            id: String(r.id),
            title: String(r.title),
            amount: Number(r.amount),
            due_date: r.due_date,
            status: String(r.status),
            category: r.category,
            created_at: r.created_at,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
