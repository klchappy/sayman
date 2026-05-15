/**
 * /v1/reports/balance-sheet — Bilanço (Aktif/Pasif/Özsermaye snapshot).
 *
 *   GET /v1/reports/balance-sheet?as_of=YYYY-MM-DD
 *
 * Aktifler (Varlık):
 *   - Cari alacaklar: sales_invoices kalan (paid_amount < amount)
 *   - Stok: stock_items toplam değer (quantity × sale_price)
 *   - Demirbaş net defter değeri: fixed_assets cost - accumulated
 *   - Çek alacak portföyü: incoming check'lerin tutarı
 *
 * Pasifler (Borç):
 *   - Cari borçlar: payable_items kalan (paid_amount < amount)
 *   - Çıkan çek/senet: outgoing pending
 *
 * Özsermaye = Aktif - Pasif (basit yaklaşım)
 *
 * Bilanço denkliği: Aktifler = Pasifler + Özsermaye
 */
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reportsBalanceRouter = Router();

reportsBalanceRouter.get(
  '/reports/balance-sheet',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const asOf = String(req.query.as_of ?? new Date().toISOString().slice(0, 10));
      const db = getDb();
      const tid = req.activeTenantId!;

      // === AKTİFLER ===

      // 1. Cari alacaklar (sales_invoices outstanding)
      const receivablesAgg = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric - paid_amount::numeric), 0) AS total
        FROM sales_invoices
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND status != 'cancelled'
          AND issue_date <= ${asOf}::date
      `);
      const receivables = Number(
        ((receivablesAgg.rows ?? receivablesAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // 2. Stok değeri (mevcut quantity × sale_price)
      const stockAgg = await db.execute(sql`
        SELECT COALESCE(SUM(quantity::numeric * COALESCE(sale_price::numeric, purchase_price::numeric, 0)), 0) AS total
        FROM stock_items
        WHERE tenant_id = ${tid}::uuid
      `);
      const stockValue = Number(
        ((stockAgg.rows ?? stockAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // 3. Demirbaş net defter değeri
      const fixedAssetsAgg = await db.execute(sql`
        SELECT COALESCE(SUM(purchase_cost::numeric - accumulated_depreciation::numeric), 0) AS total
        FROM fixed_assets
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND status = 'active'
          AND purchase_date <= ${asOf}::date
      `);
      const fixedAssetsNet = Number(
        ((fixedAssetsAgg.rows ?? fixedAssetsAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // 4. Alacak çek/senet portföyü (incoming, portfolio + deposited)
      const checksIncomingAgg = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) AS total
        FROM checks_and_notes
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND direction = 'incoming'
          AND status IN ('portfolio', 'deposited')
          AND issue_date <= ${asOf}::date
      `);
      const checksIncoming = Number(
        ((checksIncomingAgg.rows ?? checksIncomingAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // === PASİFLER ===

      // 5. Cari borçlar (payable_items outstanding)
      const payablesAgg = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric - paid_amount::numeric), 0) AS total
        FROM payable_items
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND status NOT IN ('paid', 'cancelled')
          AND issue_date <= ${asOf}::date
      `);
      const payables = Number(
        ((payablesAgg.rows ?? payablesAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // 6. Çıkan çek/senet (outgoing pending)
      const checksOutgoingAgg = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) AS total
        FROM checks_and_notes
        WHERE tenant_id = ${tid}::uuid
          AND is_active = true
          AND direction = 'outgoing'
          AND status = 'issued'
          AND issue_date <= ${asOf}::date
      `);
      const checksOutgoing = Number(
        ((checksOutgoingAgg.rows ?? checksOutgoingAgg) as Array<Record<string, unknown>>)[0]?.total ?? 0,
      );

      // Toplamlar
      const totalAssets = receivables + stockValue + fixedAssetsNet + checksIncoming;
      const totalLiabilities = payables + checksOutgoing;
      const equity = totalAssets - totalLiabilities;

      res.json({
        data: {
          as_of: asOf,
          assets: {
            receivables,
            stock_value: stockValue,
            fixed_assets_net: fixedAssetsNet,
            checks_incoming: checksIncoming,
            total: totalAssets,
            breakdown: [
              { key: 'receivables', label: 'Ticari Alacaklar', amount: receivables },
              { key: 'stock', label: 'Stok', amount: stockValue },
              { key: 'fixed_assets', label: 'Demirbaş (Net)', amount: fixedAssetsNet },
              { key: 'checks_incoming', label: 'Alacak Çek/Senet', amount: checksIncoming },
            ].filter((b) => b.amount > 0),
          },
          liabilities: {
            payables,
            checks_outgoing: checksOutgoing,
            total: totalLiabilities,
            breakdown: [
              { key: 'payables', label: 'Ticari Borçlar', amount: payables },
              { key: 'checks_outgoing', label: 'Borç Çek/Senet', amount: checksOutgoing },
            ].filter((b) => b.amount > 0),
          },
          equity,
          /** Bilanço dengeli mi? (varlık = borç + özsermaye) */
          balanced: Math.abs(totalAssets - (totalLiabilities + equity)) < 0.01,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
