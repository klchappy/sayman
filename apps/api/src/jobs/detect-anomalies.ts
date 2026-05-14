/**
 * detect-anomalies cron — daily 10:00 TR.
 *
 * Şüpheli kayıtları tespit edip admin'lere bildirim gönderir.
 *
 * Kurallar:
 *   1. Bir tedarikçi/şirket için tutar son 6 ay ortalamasının >%200 üstünde
 *      (örn ortalama 1000 TL, yeni fatura 2500 TL → şüpheli)
 *   2. Vadesi geçmiş + ödeme yok + tutar > 5000 (önemli geciken)
 *   3. Yinelenen fatura (aynı supplier + amount + 7 gün içinde 2+ kayıt)
 *
 * Idempotent: notifications.dedupe_key
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, organizations, payableItems, tenants } from '@sayman/db';
import { logger } from '../config/logger';
import { createNotificationForAdmins, todayISO } from './helpers';

export interface AnomalyResult {
  high_amount: number;
  important_overdue: number;
  duplicate_suspicious: number;
}

const AMOUNT_THRESHOLD_RATIO = 2.0; // %200 üstü
const OVERDUE_AMOUNT_THRESHOLD = 5000;
const DUPLICATE_WINDOW_DAYS = 7;

export async function runDetectAnomalies(): Promise<AnomalyResult> {
  const result: AnomalyResult = {
    high_amount: 0,
    important_overdue: 0,
    duplicate_suspicious: 0,
  };

  const db = getDb();
  const todayStr = todayISO();

  // Tüm aktif org'ları tarar
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.is_active, true));

  for (const org of orgs) {
    const tList = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.organization_id, org.id));
    const tenantIds = tList.map((t) => t.id);
    if (tenantIds.length === 0) continue;

    // --- Kural 1: Yüksek tutarlı kayıt (ortalamanın 2 katı üstünde) ---
    // Son 6 ay ortalama VS son 30 gün eklenen kayıtlar
    const highRows = await db.execute(sql`
      WITH supplier_avg AS (
        SELECT supplier_name,
               company_id,
               AVG(amount::numeric) AS avg_amount,
               COUNT(*) AS sample_count
        FROM payable_items
        WHERE tenant_id = ANY(${tenantIds}::uuid[])
          AND is_active = true
          AND created_at > NOW() - INTERVAL '6 months'
          AND created_at < NOW() - INTERVAL '30 days'
          AND (supplier_name IS NOT NULL OR company_id IS NOT NULL)
        GROUP BY supplier_name, company_id
        HAVING COUNT(*) >= 3
      )
      SELECT p.id, p.tenant_id, p.title, p.amount, p.supplier_name, p.company_id,
             sa.avg_amount, sa.sample_count
      FROM payable_items p
      JOIN supplier_avg sa
        ON (p.supplier_name IS NOT DISTINCT FROM sa.supplier_name
            AND p.company_id IS NOT DISTINCT FROM sa.company_id)
      WHERE p.tenant_id = ANY(${tenantIds}::uuid[])
        AND p.is_active = true
        AND p.created_at > NOW() - INTERVAL '30 days'
        AND p.amount::numeric > sa.avg_amount * ${AMOUNT_THRESHOLD_RATIO}
      LIMIT 50
    `);
    const highList = (highRows.rows ?? highRows) as Array<Record<string, unknown>>;

    for (const r of highList) {
      const avg = Number(r.avg_amount);
      const cur = Number(r.amount);
      const ratio = avg > 0 ? cur / avg : 0;
      const res = await createNotificationForAdmins({
        organizationId: org.id,
        tenantId: String(r.tenant_id),
        dedupeKey: `anomaly:high_amount:${r.id}:${todayStr}`,
        title: '⚠️ Beklenmedik yüksek tutar',
        body: `"${r.title}" faturası ${cur.toLocaleString('tr-TR')} TL — ${
          r.supplier_name ?? 'tedarikçi'
        } için son 6 ay ortalaması ${avg.toLocaleString('tr-TR')} TL (${ratio.toFixed(1)}x).`,
        category: 'audit',
        priority: 'warning',
        relatedTable: 'payable_items',
        relatedId: String(r.id),
        actionUrl: `/payables/${r.id}`,
      });
      result.high_amount += res.created;
    }

    // --- Kural 2: Önemli geciken (overdue + amount > 5000) ---
    const overdueRows = await db
      .select({
        id: payableItems.id,
        tenant_id: payableItems.tenant_id,
        title: payableItems.title,
        amount: payableItems.amount,
        due_date: payableItems.due_date,
      })
      .from(payableItems)
      .where(
        and(
          sql`${payableItems.tenant_id} = ANY(${tenantIds}::uuid[])`,
          eq(payableItems.is_active, true),
          eq(payableItems.status, 'overdue'),
          gte(payableItems.amount, String(OVERDUE_AMOUNT_THRESHOLD)),
        ),
      )
      .limit(50);

    for (const r of overdueRows) {
      const res = await createNotificationForAdmins({
        organizationId: org.id,
        tenantId: r.tenant_id,
        dedupeKey: `anomaly:overdue:${r.id}:${todayStr}`,
        title: '🚨 Önemli geciken fatura',
        body: `"${r.title}" — ${Number(r.amount).toLocaleString('tr-TR')} TL, vade ${r.due_date}. Acil eylem gerekli.`,
        category: 'payable_due',
        priority: 'critical',
        relatedTable: 'payable_items',
        relatedId: r.id,
        actionUrl: `/payables/${r.id}`,
      });
      result.important_overdue += res.created;
    }

    // --- Kural 3: Yinelenen fatura şüphesi (aynı supplier + amount, 7 gün içinde 2+ kayıt) ---
    const dupRows = await db.execute(sql`
      SELECT
        supplier_name, company_id, amount,
        COUNT(*) AS dup_count,
        MIN(id) AS first_id,
        MAX(id) AS last_id,
        MIN(tenant_id) AS tenant_id
      FROM payable_items
      WHERE tenant_id = ANY(${tenantIds}::uuid[])
        AND is_active = true
        AND created_at > NOW() - INTERVAL '${sql.raw(String(DUPLICATE_WINDOW_DAYS))} days'
        AND (supplier_name IS NOT NULL OR company_id IS NOT NULL)
      GROUP BY supplier_name, company_id, amount
      HAVING COUNT(*) >= 2
      LIMIT 20
    `);
    const dupList = (dupRows.rows ?? dupRows) as Array<Record<string, unknown>>;

    for (const r of dupList) {
      const res = await createNotificationForAdmins({
        organizationId: org.id,
        tenantId: String(r.tenant_id),
        dedupeKey: `anomaly:duplicate:${r.last_id}:${todayStr}`,
        title: '🔁 Yinelenen fatura şüphesi',
        body: `Aynı tedarikçi (${r.supplier_name ?? '-'}) ve tutar (${Number(r.amount).toLocaleString('tr-TR')} TL) ${DUPLICATE_WINDOW_DAYS} gün içinde ${r.dup_count} kez kaydedildi. Kontrol et — iki kez kaydedilmiş olabilir.`,
        category: 'audit',
        priority: 'warning',
        relatedTable: 'payable_items',
        relatedId: String(r.last_id),
        actionUrl: `/payables/${r.last_id}`,
      });
      result.duplicate_suspicious += res.created;
    }
  }

  logger.info({ ...result }, 'detect-anomalies completed');
  return result;
}
