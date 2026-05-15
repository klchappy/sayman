/**
 * run-depreciation cron — her ayın 1'inde 03:30 TR.
 *
 * Her aktif demirbaş için ÖNCEKİ AY'ın amortisman entry'sini idempotent yaratır
 * (unique asset_id + period). accumulated_depreciation güncellenir.
 *
 * İlk amortisman ayı: purchase_date'in olduğu ay (TR pratiğinde tam ay).
 */
import { and, eq, sql } from 'drizzle-orm';
import {
  depreciationEntries,
  fixedAssets,
  getDb,
} from '@sayman/db';
import { calculateMonthlyDepreciation } from '../lib/depreciation';
import { logger } from '../config/logger';

export interface DepreciationRunResult {
  assets_processed: number;
  entries_created: number;
  entries_skipped: number;
  total_depreciation: number;
  errors: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export async function runDepreciation(): Promise<DepreciationRunResult> {
  const result: DepreciationRunResult = {
    assets_processed: 0,
    entries_created: 0,
    entries_skipped: 0,
    total_depreciation: 0,
    errors: 0,
  };

  const db = getDb();
  const now = new Date();
  // Önceki ay (cron ayın 1'inde çalışır)
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}`;

  // Aktif tüm demirbaşlar
  const assets = await db
    .select()
    .from(fixedAssets)
    .where(and(eq(fixedAssets.status, 'active'), eq(fixedAssets.is_active, true)));

  for (const a of assets) {
    result.assets_processed++;

    // Purchase date'ten önceyse skip
    const purchaseDate = new Date(a.purchase_date);
    const periodStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    if (purchaseDate > periodStart) {
      result.entries_skipped++;
      continue;
    }

    try {
      // Idempotent: bu period için entry zaten var mı?
      const existing = await db
        .select({ id: depreciationEntries.id })
        .from(depreciationEntries)
        .where(
          and(
            eq(depreciationEntries.asset_id, a.id),
            eq(depreciationEntries.period, period),
          ),
        );
      if (existing.length > 0) {
        result.entries_skipped++;
        continue;
      }

      const monthly = calculateMonthlyDepreciation({
        purchase_cost: Number(a.purchase_cost),
        salvage_value: Number(a.salvage_value),
        useful_life_months: Number(a.useful_life_months),
        depreciation_method: a.depreciation_method,
        declining_rate_pct: a.declining_rate_pct ? Number(a.declining_rate_pct) : null,
        accumulated_depreciation: Number(a.accumulated_depreciation),
      });

      if (monthly === 0) {
        result.entries_skipped++;
        continue;
      }

      const newAccumulated = Number(a.accumulated_depreciation) + monthly;
      const bookValue = Number(a.purchase_cost) - newAccumulated;

      // Entry yarat
      await db.insert(depreciationEntries).values({
        tenant_id: a.tenant_id,
        asset_id: a.id,
        period,
        depreciation_amount: String(monthly.toFixed(2)),
        accumulated_depreciation: String(newAccumulated.toFixed(2)),
        book_value_after: String(bookValue.toFixed(2)),
      });

      // Asset üzerinde accumulated güncelle
      await db
        .update(fixedAssets)
        .set({
          accumulated_depreciation: String(newAccumulated.toFixed(2)),
          updated_at: new Date(),
        })
        .where(eq(fixedAssets.id, a.id));

      result.entries_created++;
      result.total_depreciation += monthly;
    } catch (err) {
      logger.error({ err, assetId: a.id }, 'depreciation entry failed');
      result.errors++;
    }
  }

  if (result.entries_created > 0 || result.errors > 0) {
    logger.info({ ...result, period }, 'run-depreciation completed');
  }
  return result;
}
