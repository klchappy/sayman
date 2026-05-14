/**
 * /v1/forecast/cashflow — basit lineer regresyon ile nakit projeksiyon.
 *
 * Veri kaynağı: payable_items son 6 ay (created_at) — toplam ay başına.
 * Method: en küçük kareler yöntemi (y = mx + b)
 *
 *   GET /v1/forecast/cashflow?months=6
 *     → past: Array<{ ym, total_expense, total_paid }>
 *     → future: Array<{ ym, projected_expense }>
 *     → trend: { slope, intercept, r_squared }
 *
 * Not: Bu çok basit bir tahmin. Seasonality / outlier handling yok.
 * "Geçen 6 aya göre önümüzdeki 6 ay" intuitive bir sinyaldir.
 */
import { and, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, payableItems } from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const forecastRouter = Router();

interface MonthAgg {
  ym: string;
  total_expense: number;
  total_paid: number;
}

function linearRegression(points: number[]): {
  slope: number;
  intercept: number;
  r_squared: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0] ?? 0, r_squared: 0 };

  const xs = points.map((_, i) => i);
  const ys = points;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean);
    denom += (xs[i]! - xMean) ** 2;
  }
  const slope = denom === 0 ? 0 : num / denom;
  const intercept = yMean - slope * xMean;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yi = ys[i]!;
    const yPred = slope * xs[i]! + intercept;
    ssTot += (yi - yMean) ** 2;
    ssRes += (yi - yPred) ** 2;
  }
  const r_squared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r_squared };
}

function addMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

forecastRouter.get('/forecast/cashflow', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tenantId = req.saymanContext?.tenantId;
    if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

    const monthsAhead = Math.max(1, Math.min(12, Number(req.query.months ?? 6)));
    const lookback = 6;
    const db = getDb();

    const rows = await db.execute(sql`
      WITH series AS (
        SELECT to_char(date_trunc('month', NOW()) - (n || ' months')::interval, 'YYYY-MM') AS ym
        FROM generate_series(0, ${lookback - 1}) AS n
      )
      SELECT
        s.ym,
        COALESCE(SUM(p.amount::numeric), 0) AS total_expense,
        COALESCE(SUM(p.paid_amount::numeric), 0) AS total_paid
      FROM series s
      LEFT JOIN ${payableItems} p
        ON to_char(p.created_at, 'YYYY-MM') = s.ym
        AND p.tenant_id = ${tenantId}
        AND p.is_active = true
      GROUP BY s.ym
      ORDER BY s.ym ASC
    `);

    const past: MonthAgg[] = ((rows.rows ?? rows) as any[]).map((r) => ({
      ym: String(r.ym),
      total_expense: Number(r.total_expense ?? 0),
      total_paid: Number(r.total_paid ?? 0),
    }));

    const trend = linearRegression(past.map((p) => p.total_expense));

    const future: Array<{ ym: string; projected_expense: number }> = [];
    const lastYm = past[past.length - 1]?.ym ?? new Date().toISOString().slice(0, 7);
    for (let i = 1; i <= monthsAhead; i++) {
      const x = lookback - 1 + i;
      const projected = Math.max(0, trend.slope * x + trend.intercept);
      future.push({ ym: addMonth(lastYm, i), projected_expense: Math.round(projected * 100) / 100 });
    }

    res.json({
      data: {
        past,
        future,
        trend: {
          slope: Math.round(trend.slope * 100) / 100,
          intercept: Math.round(trend.intercept * 100) / 100,
          r_squared: Math.round(trend.r_squared * 1000) / 1000,
          direction: trend.slope > 0 ? 'rising' : trend.slope < 0 ? 'falling' : 'flat',
        },
        meta: {
          lookback_months: lookback,
          projection_months: monthsAhead,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
