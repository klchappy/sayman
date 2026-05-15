/**
 * budget-alerts cron — günde bir, 08:00 TR.
 *
 * Her aktif bütçe için gerçekleşen vs planlanan karşılaştırır.
 * Eşik (default %80) aşıldığında bir kez uyarı bildirimi gönderir
 * (alerted_at ile idempotent; period sona erince reset olur).
 */
import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import {
  budgets,
  getDb,
  payableItems,
  tenants,
  tenants as tenantsTbl,
} from '@sayman/db';
import { logger } from '../config/logger';
import { createNotificationForAdmins } from './helpers';

export interface BudgetAlertResult {
  checked: number;
  alerted: number;
  over_budget: number;
}

function periodToRange(period: string, kind: string): { from: string; to: string } | null {
  if (kind === 'monthly') {
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const from = `${y}-${String(mm).padStart(2, '0')}-01`;
    const last = new Date(y, mm, 0).getDate();
    return {
      from,
      to: `${y}-${String(mm).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    };
  }
  if (kind === 'quarterly') {
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    const y = Number(m[1]);
    const q = Number(m[2]);
    const mStart = (q - 1) * 3 + 1;
    const mEnd = q * 3;
    const lastDay = new Date(y, mEnd, 0).getDate();
    return {
      from: `${y}-${String(mStart).padStart(2, '0')}-01`,
      to: `${y}-${String(mEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (kind === 'yearly') {
    const y = Number(period);
    if (isNaN(y)) return null;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return null;
}

export async function runBudgetAlerts(): Promise<BudgetAlertResult> {
  const result: BudgetAlertResult = { checked: 0, alerted: 0, over_budget: 0 };
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Aktif, henüz uyarılmamış veya gün geçmiş bütçeler
  const activeBudgets = await db
    .select({
      id: budgets.id,
      tenant_id: budgets.tenant_id,
      category: budgets.category,
      period: budgets.period,
      period_kind: budgets.period_kind,
      planned_amount: budgets.planned_amount,
      alert_threshold_pct: budgets.alert_threshold_pct,
      alerted_at: budgets.alerted_at,
    })
    .from(budgets)
    .where(eq(budgets.is_active, true));

  for (const b of activeBudgets) {
    result.checked++;
    const range = periodToRange(b.period, b.period_kind);
    if (!range) continue;
    // Period bittiyse atla
    if (range.to < today) continue;
    // Henüz başlamadıysa atla
    if (range.from > today) continue;

    // Gerçekleşen tutar
    const [r] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric), 0)`,
      })
      .from(payableItems)
      .where(
        and(
          eq(payableItems.tenant_id, b.tenant_id),
          eq(payableItems.is_active, true),
          eq(payableItems.category, b.category),
          gte(payableItems.issue_date, range.from),
          lte(payableItems.issue_date, range.to),
        ),
      );

    const actual = Number(r?.total ?? 0);
    const planned = Number(b.planned_amount);
    const threshold = Number(b.alert_threshold_pct);
    if (planned <= 0) continue;
    const usagePct = (actual / planned) * 100;

    // Eşiği aştı mı + henüz bu period için uyarılmadı mı
    if (usagePct < threshold) continue;
    if (b.alerted_at) continue; // bu period için zaten uyarıldı

    if (actual > planned) result.over_budget++;

    // Tenant'ın org_id'sini al
    const [t] = await db
      .select({ organization_id: tenantsTbl.organization_id, slug: tenantsTbl.slug })
      .from(tenantsTbl)
      .where(eq(tenantsTbl.id, b.tenant_id));
    if (!t) continue;

    const isOver = actual > planned;
    const title = isOver
      ? `🚨 Bütçe Aşıldı: ${b.category} (${b.period})`
      : `⚠️ Bütçe Uyarısı: ${b.category} (${b.period})`;
    const body = `${b.category} kategorisinde planlanan ${planned.toLocaleString('tr-TR')} TL'nin ${usagePct.toFixed(0)}%'i kullanıldı (${actual.toLocaleString('tr-TR')} TL). ${isOver ? 'Bütçeyi aştın.' : 'Eşik yaklaştı.'}`;

    try {
      await createNotificationForAdmins({
        organizationId: t.organization_id,
        tenantId: b.tenant_id,
        dedupeKey: `budget:${b.id}:${b.period}`,
        title,
        body,
        category: 'audit',
        priority: isOver ? 'critical' : 'warning',
        relatedTable: 'budgets',
        relatedId: b.id,
        actionUrl: '/budgets',
      });
      await db.update(budgets).set({ alerted_at: new Date() }).where(eq(budgets.id, b.id));
      result.alerted++;
    } catch (err) {
      logger.error({ err, budgetId: b.id }, 'budget alert failed');
    }
  }

  logger.info(result, 'budget-alerts completed');
  return result;
}
