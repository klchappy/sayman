/**
 * /v1/fx-rates — TCMB döviz kurları sorgu (read-only).
 *
 *   GET /v1/fx-rates                 → son 7 günün her para birimi
 *   GET /v1/fx-rates/latest          → en güncel tarih (her para birimi)
 *   GET /v1/fx-rates/:currency       → belirli para birimi 30 günlük seri
 *
 * Auth: any user (org-bağımsız — TCMB verisi public).
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { fxRates, getDb } from '@sayman/db';
import { requireAuth } from '../middleware/auth';

export const fxRatesRouter = Router();

fxRatesRouter.get('/fx-rates/latest', requireAuth, async (_req, res, next) => {
  try {
    const db = getDb();
    // Her para birimi için en yüksek fx_date
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (currency)
        currency, fx_date, rate_try, forex_buying, forex_selling
      FROM fx_rates
      ORDER BY currency, fx_date DESC
    `);
    res.json({ data: rows.rows ?? rows });
  } catch (err) {
    next(err);
  }
});

fxRatesRouter.get('/fx-rates/:currency', requireAuth, async (req, res, next) => {
  try {
    const currency = String(req.params.currency ?? '').toUpperCase();
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.currency, currency), gte(fxRates.fx_date, sinceStr)))
      .orderBy(desc(fxRates.fx_date))
      .limit(30);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

fxRatesRouter.get('/fx-rates', requireAuth, async (_req, res, next) => {
  try {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(fxRates)
      .where(gte(fxRates.fx_date, sinceStr))
      .orderBy(desc(fxRates.fx_date), fxRates.currency);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
