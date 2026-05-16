/**
 * generate-ai-summary cron — daily 07:00 TR.
 *
 * Her aktif tenant için Claude API'sine gün özetini ürettirip
 * ai_summaries tablosuna cache'ler. Dashboard widget bu cache'den
 * okur (her view'da Claude çağrılmasın).
 *
 * Idempotent: ai_summaries (tenant_id, summary_date, kind) unique.
 *
 * Telegram chat_id'si bağlı admin/super_admin'lere de özet düşer.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import {
  aiSummaries,
  getDb,
  guarantees,
  payableItems,
  tenants,
} from '@sayman/db';
import { logger } from '../config/logger';
import { generateText } from '../lib/ai-providers';
import { sendTelegramMessage } from '../lib/telegram';
import { getOrgAdmins, todayISO } from './helpers';

export interface AiSummaryResult {
  attempted: number;
  generated: number;
  skipped: number;
  failed: number;
}

interface TenantSnapshot {
  tenant_slug: string;
  total_open_balance: number;
  payable_count: number;
  overdue_count: number;
  overdue_amount: number;
  approaching_count: number;
  approaching_amount: number;
  paid_today_amount: number;
  guarantees_expiring_30d: number;
  top_overdue: Array<{ title: string; amount: number; due_date: string; supplier: string | null }>;
}

async function fetchSnapshot(tenantId: string, tenantSlug: string): Promise<TenantSnapshot> {
  const db = getDb();
  const today = todayISO();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  const [agg] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric - ${payableItems.paid_amount}::numeric), 0)`,
      count: sql<string>`COUNT(*)`,
      overdue_count: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'overdue')`,
      overdue_amount: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric - ${payableItems.paid_amount}::numeric) FILTER (WHERE ${payableItems.status} = 'overdue'), 0)`,
      approaching_count: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.status} = 'approaching')`,
      approaching_amount: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric - ${payableItems.paid_amount}::numeric) FILTER (WHERE ${payableItems.status} = 'approaching'), 0)`,
    })
    .from(payableItems)
    .where(and(eq(payableItems.tenant_id, tenantId), eq(payableItems.is_active, true)));

  const topOverdue = await db
    .select({
      title: payableItems.title,
      amount: payableItems.amount,
      due_date: payableItems.due_date,
      supplier: payableItems.supplier_name,
    })
    .from(payableItems)
    .where(
      and(
        eq(payableItems.tenant_id, tenantId),
        eq(payableItems.is_active, true),
        eq(payableItems.status, 'overdue'),
      ),
    )
    .orderBy(sql`${payableItems.amount}::numeric DESC`)
    .limit(5);

  const [guar] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(guarantees)
    .where(
      and(
        eq(guarantees.tenant_id, tenantId),
        eq(guarantees.is_active, true),
        eq(guarantees.status, 'active'),
        gte(guarantees.expiry_date, today),
        lte(guarantees.expiry_date, in30Str),
      ),
    );

  return {
    tenant_slug: tenantSlug,
    total_open_balance: Number(agg?.total ?? 0),
    payable_count: Number(agg?.count ?? 0),
    overdue_count: Number(agg?.overdue_count ?? 0),
    overdue_amount: Number(agg?.overdue_amount ?? 0),
    approaching_count: Number(agg?.approaching_count ?? 0),
    approaching_amount: Number(agg?.approaching_amount ?? 0),
    paid_today_amount: 0,
    guarantees_expiring_30d: Number(guar?.count ?? 0),
    top_overdue: topOverdue.map((o) => ({
      title: o.title,
      amount: Number(o.amount),
      due_date: o.due_date ?? '-',
      supplier: o.supplier,
    })),
  };
}

async function generateSummaryText(
  snapshot: TenantSnapshot,
  organizationId: string,
  tenantId: string,
): Promise<string> {
  try {
    // Org-level credentials veya env fallback — `generateText` ikisini de okur.
    // Yapılandırma yoksa AI_NOT_CONFIGURED throw eder, catch fallback'e düşer.
    const r = await generateText(
      {
        system:
          'Sen Sayman muhasebe SaaS gunluk ozet asistanisin. Verilen JSON snapshot uzerinden ' +
          'KISA (en fazla 4-5 cumle) ve EYLEM ODAKLI bir Turkce gunluk ozet yaz. Sayilar TL formatla ' +
          '(1.234,56 TL). Madde isaretleri kullanma, akici paragraf yaz. ' +
          'Eger oncelikli sorun yoksa "bugun acil bir durum yok" diye sakin bir ton kullan.',
        prompt: `Tenant: ${snapshot.tenant_slug}\nVeri:\n${JSON.stringify(snapshot, null, 2)}\n\nGunluk ozet yaz.`,
        maxTokens: 400,
        timeoutMs: 30_000,
      },
      { organizationId, tenantId },
    );
    return r.text.trim() || buildFallbackText(snapshot);
  } catch (err) {
    logger.warn({ err }, 'AI summary: provider call failed, using fallback');
    return buildFallbackText(snapshot);
  }
}

function fmt(n: number): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildFallbackText(s: TenantSnapshot): string {
  const parts: string[] = [];
  if (s.overdue_count > 0) {
    parts.push(
      `${s.overdue_count} geciken fatura (${fmt(s.overdue_amount)} TL) acilen ilgilenilmeli.`,
    );
  }
  if (s.approaching_count > 0) {
    parts.push(
      `${s.approaching_count} fatura yaklasiyor (${fmt(s.approaching_amount)} TL).`,
    );
  }
  if (s.guarantees_expiring_30d > 0) {
    parts.push(`${s.guarantees_expiring_30d} teminat mektubu 30 gun icinde dolacak.`);
  }
  if (s.total_open_balance > 0) {
    parts.push(`Toplam acik bakiye: ${fmt(s.total_open_balance)} TL.`);
  }
  if (parts.length === 0) return 'Bugun acil bir durum yok. Tum kayitlar gunceldir.';
  return parts.join(' ');
}

export interface RunOpts {
  /** True ise Telegram bildirimi at (default false — sadece cron 07:00'de true) */
  sendTelegram?: boolean;
}

export async function runGenerateAiSummary(opts: RunOpts = {}): Promise<AiSummaryResult> {
  const result: AiSummaryResult = { attempted: 0, generated: 0, skipped: 0, failed: 0 };
  const db = getDb();
  const today = todayISO();

  const allTenants = await db
    .select({ id: tenants.id, slug: tenants.slug, organization_id: tenants.organization_id })
    .from(tenants)
    .where(eq(tenants.is_active, true));

  for (const t of allTenants) {
    result.attempted++;
    try {
      const existing = await db
        .select({ id: aiSummaries.id })
        .from(aiSummaries)
        .where(
          and(
            eq(aiSummaries.tenant_id, t.id),
            eq(aiSummaries.summary_date, today),
            eq(aiSummaries.kind, 'daily'),
          ),
        );
      if (existing.length > 0) {
        result.skipped++;
        continue;
      }

      const t0 = Date.now();
      const snapshot = await fetchSnapshot(t.id, t.slug);
      const text = await generateSummaryText(snapshot, t.organization_id, t.id);
      const dur = Date.now() - t0;

      await db.insert(aiSummaries).values({
        tenant_id: t.id,
        summary_date: today,
        kind: 'daily',
        summary_text: text,
        source_data: snapshot,
        duration_ms: String(dur),
      });
      result.generated++;

      // Telegram'a yolla — sadece cron 07:00'de
      if (opts.sendTelegram) {
        try {
          const admins = await getOrgAdmins(t.organization_id);
          const message = `📊 *Sayman Günlük Özet* — ${t.slug}\n\n${text}\n\n_${today}_`;
          for (const a of admins) {
            if (a.telegram_chat_id) {
              await sendTelegramMessage({
                chatId: a.telegram_chat_id,
                text: message,
                parseMode: 'Markdown',
                disableNotification: true,
              });
            }
          }
        } catch (err) {
          logger.warn({ err, tenantId: t.id }, 'AI summary: telegram send failed');
        }
      }
    } catch (err) {
      logger.error({ err, tenantId: t.id }, 'AI summary: tenant generation failed');
      result.failed++;
    }
  }

  logger.info({ ...result, telegram: opts.sendTelegram }, 'generate-ai-summary completed');
  return result;
}
