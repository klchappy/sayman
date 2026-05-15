/**
 * Amortisman hesabı yardımcıları.
 *
 * Lineer (eşit taksit):
 *   monthly = (cost - salvage) / life_months
 *
 * Azalan bakiyeler (declining balance):
 *   monthly = remaining_value × (annual_rate / 12)
 *   Hurda değerin altına düşmez.
 */

export interface AssetDepreciation {
  purchase_cost: number;
  salvage_value: number;
  useful_life_months: number;
  depreciation_method: 'linear' | 'declining_balance' | string;
  declining_rate_pct: number | null;
  accumulated_depreciation: number;
}

/**
 * Bu ay için tek bir amortisman tutarını hesapla.
 * remaining_value, salvage'a düşmüşse 0 döner.
 */
export function calculateMonthlyDepreciation(a: AssetDepreciation): number {
  const remaining = a.purchase_cost - a.accumulated_depreciation;
  if (remaining <= a.salvage_value) return 0;
  const depreciableBase = a.purchase_cost - a.salvage_value;

  let monthly: number;
  if (a.depreciation_method === 'declining_balance' && a.declining_rate_pct) {
    monthly = (remaining * a.declining_rate_pct) / 100 / 12;
  } else {
    // linear
    monthly = depreciableBase / Math.max(1, a.useful_life_months);
  }

  // Hurda değer alttan kıs
  const maxThisMonth = remaining - a.salvage_value;
  return Math.max(0, Math.min(monthly, maxThisMonth));
}

/**
 * Bir asset için satın alma tarihinden bugüne aylık amortisman çizelgesi üretir.
 * Cron veya schedule preview için kullanılır.
 */
export function buildSchedule(
  a: AssetDepreciation,
  purchaseDate: string,
  toDate: Date = new Date(),
): Array<{ period: string; amount: number; accumulated: number; book_value: number }> {
  const schedule: Array<{ period: string; amount: number; accumulated: number; book_value: number }> = [];
  const start = new Date(purchaseDate);
  // İlk ay tam ay (TR muhasebe pratiği — yıl içi kıst dönem değil)
  start.setDate(1);

  let accumulated = 0;
  const cursor = new Date(start);
  while (cursor <= toDate) {
    const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const monthly = calculateMonthlyDepreciation({
      ...a,
      accumulated_depreciation: accumulated,
    });
    accumulated += monthly;
    const bookValue = a.purchase_cost - accumulated;
    schedule.push({
      period,
      amount: Math.round(monthly * 100) / 100,
      accumulated: Math.round(accumulated * 100) / 100,
      book_value: Math.round(bookValue * 100) / 100,
    });
    if (monthly === 0) break; // amortisman bitti
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return schedule;
}
