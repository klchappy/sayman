/**
 * generate-tax-calendar cron — her ay 1'inde çalışır.
 *
 * Türkiye vergi takvimi sabit kurallarına göre gelecek 90 günün event'lerini
 * her aktif tenant için idempotent yaratır. unique (tenant_id, kind, period).
 *
 * Sabit kurallar:
 *   - KDV beyanname:        her ayın 28'i  (önceki ayın KDV'si)
 *   - Muhtasar + Prim:      her ayın 26'sı (önceki ayın gelir vergisi stopajı)
 *   - Geçici vergi:         Şub 17, May 17, Ağu 17, Kas 17 (önceki çeyrek)
 *   - Kurumlar vergisi:     Nisan 30 (önceki yıl)
 *   - MTV:                  Ocak 31, Temmuz 31
 *   - Damga vergisi:        her ayın 26'sı
 *   - BAĞ-KUR primi:        ay sonu (4b sigortalı)
 *   - SGK primi:            her ayın 23'ü
 */
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getDb, taxCalendarEvents, tenants } from '@sayman/db';
import { logger } from '../config/logger';

export interface TaxCalendarResult {
  attempted: number;
  created: number;
  skipped: number;
}

interface EventTemplate {
  kind: string;
  /** YYYY-MM-DD formatında due_date */
  due_date: string;
  period: string;
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function generateTemplates(now: Date): EventTemplate[] {
  const list: EventTemplate[] = [];
  // Bugünden +90 güne kadar 4 ay tarayalım
  for (let monthOffset = 0; monthOffset < 4; monthOffset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const ym = `${y}-${pad(m + 1)}`;

    // Önceki ay (KDV/muhtasar konusu olan ay)
    const prevD = new Date(y, m - 1, 1);
    const prevYm = `${prevD.getFullYear()}-${pad(prevD.getMonth() + 1)}`;
    const prevMonthName = prevD.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    // KDV beyanname: ayın 28'i
    list.push({
      kind: 'kdv',
      period: prevYm,
      due_date: `${y}-${pad(m + 1)}-28`,
      label: `${prevMonthName} KDV Beyannamesi`,
    });

    // Muhtasar + Prim: ayın 26'sı
    list.push({
      kind: 'muhtasar',
      period: prevYm,
      due_date: `${y}-${pad(m + 1)}-26`,
      label: `${prevMonthName} Muhtasar ve Prim Hizmet Beyannamesi`,
    });

    // Damga vergisi: ayın 26'sı
    list.push({
      kind: 'damga',
      period: prevYm,
      due_date: `${y}-${pad(m + 1)}-26`,
      label: `${prevMonthName} Damga Vergisi`,
    });

    // SGK primi: ayın 23'ü
    list.push({
      kind: 'sgk',
      period: prevYm,
      due_date: `${y}-${pad(m + 1)}-23`,
      label: `${prevMonthName} SGK Primi`,
    });

    // BAĞ-KUR: ay sonu (son günü hesapla)
    const lastDay = new Date(y, m + 1, 0).getDate();
    list.push({
      kind: 'bagkur',
      period: ym,
      due_date: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
      label: `${d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} BAĞ-KUR Primi`,
    });

    // Geçici vergi (Şubat 17, Mayıs 17, Ağustos 17, Kasım 17)
    if (m === 1) {
      list.push({
        kind: 'gecici_vergi',
        period: `${y - 1}-Q4`,
        due_date: `${y}-02-17`,
        label: `${y - 1} 4. Geçici Vergi Beyannamesi`,
      });
    } else if (m === 4) {
      list.push({
        kind: 'gecici_vergi',
        period: `${y}-Q1`,
        due_date: `${y}-05-17`,
        label: `${y} 1. Geçici Vergi Beyannamesi`,
      });
    } else if (m === 7) {
      list.push({
        kind: 'gecici_vergi',
        period: `${y}-Q2`,
        due_date: `${y}-08-17`,
        label: `${y} 2. Geçici Vergi Beyannamesi`,
      });
    } else if (m === 10) {
      list.push({
        kind: 'gecici_vergi',
        period: `${y}-Q3`,
        due_date: `${y}-11-17`,
        label: `${y} 3. Geçici Vergi Beyannamesi`,
      });
    }

    // Kurumlar vergisi: Nisan 30
    if (m === 3) {
      list.push({
        kind: 'kurumlar_vergisi',
        period: String(y - 1),
        due_date: `${y}-04-30`,
        label: `${y - 1} Kurumlar Vergisi Beyannamesi`,
      });
    }

    // MTV: Ocak 31 ve Temmuz 31
    if (m === 0) {
      list.push({
        kind: 'mtv',
        period: `${y}-1`,
        due_date: `${y}-01-31`,
        label: `${y} 1. Taksit MTV (Motorlu Taşıtlar Vergisi)`,
      });
    } else if (m === 6) {
      list.push({
        kind: 'mtv',
        period: `${y}-2`,
        due_date: `${y}-07-31`,
        label: `${y} 2. Taksit MTV`,
      });
    }
  }
  return list;
}

export async function runGenerateTaxCalendar(): Promise<TaxCalendarResult> {
  const result: TaxCalendarResult = { attempted: 0, created: 0, skipped: 0 };
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const allTenants = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.is_active, true));

  const templates = generateTemplates(now);

  for (const t of allTenants) {
    for (const tpl of templates) {
      // Geçmiş tarihleri atla
      if (tpl.due_date < today) continue;
      result.attempted++;
      try {
        const insertResult = await db
          .insert(taxCalendarEvents)
          .values({
            tenant_id: t.id,
            kind: tpl.kind,
            label: tpl.label,
            period: tpl.period,
            due_date: tpl.due_date,
          })
          .onConflictDoNothing({
            target: [
              taxCalendarEvents.tenant_id,
              taxCalendarEvents.kind,
              taxCalendarEvents.period,
            ],
          })
          .returning({ id: taxCalendarEvents.id });

        if (insertResult.length > 0) result.created++;
        else result.skipped++;
      } catch (err) {
        logger.error({ err, tenantId: t.id, kind: tpl.kind }, 'tax calendar insert failed');
      }
    }
  }

  logger.info(result, 'generate-tax-calendar completed');
  return result;
}
