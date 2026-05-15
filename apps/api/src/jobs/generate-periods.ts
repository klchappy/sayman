/**
 * generate-periods cron job — daily 03:00 TR.
 *
 * Aktif profilleri tara, gelecek 3 ay için eksik periodları auto-create:
 *
 *   regular_payment_profiles → regular_payment_periods   (kira/leasing/bakım — aylık)
 *   official_payment_profiles → official_payment_periods (BAGKUR/SSK/vergi — periyot frequency'e göre)
 *   guarantees → guarantee_commission_periods            (commission_frequency_months periyotlu)
 *
 * Idempotent: aynı (profile_id + period_label) varsa atla. period_label = YYYY-MM.
 */
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  getDb,
  guaranteeCommissionPeriods,
  guarantees,
  officialPaymentPeriods,
  officialPaymentProfiles,
  regularPaymentPeriods,
  regularPaymentProfiles,
} from '@sayman/db';
import { logger } from '../config/logger';
import { addMonths, dateToYM } from './helpers';

const LOOKAHEAD_MONTHS = 3;

export interface PeriodGenResult {
  regular_created: number;
  official_created: number;
  guarantee_created: number;
}

export async function runGeneratePeriods(): Promise<PeriodGenResult> {
  const result: PeriodGenResult = {
    regular_created: 0,
    official_created: 0,
    guarantee_created: 0,
  };

  result.regular_created = await generateRegularPayments();
  result.official_created = await generateOfficialPayments();
  result.guarantee_created = await generateGuaranteeCommissions();

  logger.info({ ...result }, 'generate-periods completed');
  return result;
}

// --- Regular payments (kira/leasing/bakım — aylık) -------------------------

async function generateRegularPayments(): Promise<number> {
  const db = getDb();
  const today = new Date();
  const endDate = addMonths(today, LOOKAHEAD_MONTHS);

  const profiles = await db
    .select()
    .from(regularPaymentProfiles)
    .where(eq(regularPaymentProfiles.is_active, true));

  let created = 0;

  for (const p of profiles) {
    // Profil iterasyonu: today'den endDate'e kadar her ay
    // Tek profilin tüm period'ları atomik — kısmen oluşmuş tutarsız durum kalmaz
    const cursorStart = p.start_date ? new Date(p.start_date) : today;
    const profileEnd = p.end_date ? new Date(p.end_date) : null;

    await db.transaction(async (tx) => {
      let cursor = new Date(
        Math.max(
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).getTime(),
          new Date(Date.UTC(cursorStart.getUTCFullYear(), cursorStart.getUTCMonth(), 1)).getTime(),
        ),
      );

      while (cursor <= endDate) {
        if (profileEnd && cursor > profileEnd) break;

        const periodLabel = dateToYM(cursor);
        const dueDate = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), p.payment_day ?? 1),
        );

        const [existing] = await tx
          .select({ id: regularPaymentPeriods.id })
          .from(regularPaymentPeriods)
          .where(
            and(
              eq(regularPaymentPeriods.profile_id, p.id),
              eq(regularPaymentPeriods.period_label, periodLabel),
            ),
          );

        if (!existing) {
          let amount = p.monthly_amount ?? '0';
          if (p.next_increase_date && p.annual_increase_rate) {
            const niDate = new Date(p.next_increase_date);
            if (cursor >= niDate) {
              const rate = Number(p.annual_increase_rate);
              amount = (Number(amount) * (1 + rate / 100)).toFixed(2);
            }
          }

          await tx.insert(regularPaymentPeriods).values({
            tenant_id: p.tenant_id,
            profile_id: p.id,
            period_label: periodLabel,
            due_date: dueDate.toISOString().slice(0, 10),
            amount,
            status: 'pending',
          });
          created++;
        }

        cursor = addMonths(cursor, 1);
      }
    });
  }

  return created;
}

// --- Official payments (BAGKUR/SSK/vergi) ----------------------------------

const FREQ_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  occasional: 12, // occasional'i yearly gibi davran
};

async function generateOfficialPayments(): Promise<number> {
  const db = getDb();
  const today = new Date();
  const endDate = addMonths(today, LOOKAHEAD_MONTHS);

  const profiles = await db
    .select()
    .from(officialPaymentProfiles)
    .where(eq(officialPaymentProfiles.is_active, true));

  let created = 0;

  for (const p of profiles) {
    const freqM = FREQ_MONTHS[p.frequency] ?? 1;

    // Son period_label'i bul, oradan ilerle
    const [lastPeriod] = await db
      .select()
      .from(officialPaymentPeriods)
      .where(eq(officialPaymentPeriods.profile_id, p.id))
      .orderBy(desc(officialPaymentPeriods.period_label))
      .limit(1);

    let cursor: Date;
    if (lastPeriod) {
      const lastDate = new Date(lastPeriod.period_label + '-01T00:00:00Z');
      cursor = addMonths(lastDate, freqM);
    } else {
      cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    }

    while (cursor <= endDate) {
      const periodLabel = dateToYM(cursor);
      const dueDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 15)); // ayın 15'i default

      const [existing] = await db
        .select({ id: officialPaymentPeriods.id })
        .from(officialPaymentPeriods)
        .where(
          and(
            eq(officialPaymentPeriods.profile_id, p.id),
            eq(officialPaymentPeriods.period_label, periodLabel),
          ),
        );

      if (!existing) {
        await db.insert(officialPaymentPeriods).values({
          tenant_id: p.tenant_id,
          profile_id: p.id,
          period_label: periodLabel,
          due_date: dueDate.toISOString().slice(0, 10),
          amount: p.typical_amount ?? '0',
          status: 'pending',
        });
        created++;
      }

      cursor = addMonths(cursor, freqM);
    }
  }

  return created;
}

// --- Guarantee commission periods ------------------------------------------

async function generateGuaranteeCommissions(): Promise<number> {
  const db = getDb();
  const today = new Date();

  const rows = await db
    .select()
    .from(guarantees)
    .where(and(eq(guarantees.is_active, true), eq(guarantees.status, 'active')));

  let created = 0;

  for (const g of rows) {
    if (!g.issue_date || !g.expiry_date || !g.commission_rate || !g.commission_frequency_months) continue;

    const freqM = g.commission_frequency_months;
    const issue = new Date(g.issue_date);
    const expiry = new Date(g.expiry_date);

    // Son commission period'u bul
    const [lastPeriod] = await db
      .select()
      .from(guaranteeCommissionPeriods)
      .where(eq(guaranteeCommissionPeriods.guarantee_id, g.id))
      .orderBy(desc(guaranteeCommissionPeriods.due_date))
      .limit(1);

    let cursor: Date;
    if (lastPeriod) {
      cursor = addMonths(new Date(lastPeriod.due_date as string), freqM);
    } else {
      cursor = new Date(issue);
    }

    // Sadece bugüne kadar oluştur (sonsuza kadar değil)
    const lookaheadEnd = addMonths(today, LOOKAHEAD_MONTHS);
    const targetEnd = expiry < lookaheadEnd ? expiry : lookaheadEnd;

    while (cursor <= targetEnd) {
      const dueDateStr = cursor.toISOString().slice(0, 10);
      const periodLabel = dateToYM(cursor);

      const [existing] = await db
        .select({ id: guaranteeCommissionPeriods.id })
        .from(guaranteeCommissionPeriods)
        .where(
          and(
            eq(guaranteeCommissionPeriods.guarantee_id, g.id),
            eq(guaranteeCommissionPeriods.due_date, dueDateStr),
          ),
        );

      if (!existing) {
        const commissionAmount = (
          (Number(g.amount) * Number(g.commission_rate)) /
          100
        ).toFixed(2);

        await db.insert(guaranteeCommissionPeriods).values({
          tenant_id: g.tenant_id,
          guarantee_id: g.id,
          period_label: periodLabel,
          due_date: dueDateStr,
          amount: commissionAmount,
          status: 'pending',
        });
        created++;
      }

      cursor = addMonths(cursor, freqM);
    }
  }

  return created;
}
