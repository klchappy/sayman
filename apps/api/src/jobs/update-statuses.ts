/**
 * update-statuses cron job — hourly.
 *
 *   pending     + due_date <= today+3  → approaching
 *   approaching + due_date <  today    → overdue
 *   pending     + due_date <  today    → overdue
 *
 * Aynı sweep regular_payment_periods + official_payment_periods +
 * guarantee_commission_periods + payable_items üzerinde.
 */
import { and, eq, lt, lte, sql } from 'drizzle-orm';
import {
  getDb,
  guaranteeCommissionPeriods,
  officialPaymentPeriods,
  payableItems,
  regularPaymentPeriods,
} from '@sayman/db';
import { logger } from '../config/logger';
import { plusDays } from './helpers';

export interface StatusSweepResult {
  approaching_count: number;
  overdue_count: number;
}

export async function runUpdateStatuses(): Promise<StatusSweepResult> {
  const result: StatusSweepResult = {
    approaching_count: 0,
    overdue_count: 0,
  };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const threeDaysOutStr = plusDays(today, 3);

  const db = getDb();

  // pending + due <= today+3 → approaching
  for (const [table, label] of [
    [payableItems, 'payableItems'],
    [regularPaymentPeriods, 'regularPaymentPeriods'],
    [officialPaymentPeriods, 'officialPaymentPeriods'],
    [guaranteeCommissionPeriods, 'guaranteeCommissionPeriods'],
  ] as const) {
    const upd = await db
      .update(table)
      .set({ status: 'approaching' })
      .where(
        and(eq(table.status, 'pending'), lte(table.due_date, threeDaysOutStr), sql`${table.due_date} >= ${todayStr}`),
      )
      .returning({ id: table.id });
    result.approaching_count += upd.length;
    if (upd.length > 0) logger.info({ table: label, count: upd.length }, 'approaching');
  }

  // pending/approaching + due_date < today → overdue
  for (const [table, label] of [
    [payableItems, 'payableItems'],
    [regularPaymentPeriods, 'regularPaymentPeriods'],
    [officialPaymentPeriods, 'officialPaymentPeriods'],
    [guaranteeCommissionPeriods, 'guaranteeCommissionPeriods'],
  ] as const) {
    const upd = await db
      .update(table)
      .set({ status: 'overdue' })
      .where(
        and(
          sql`${table.status} IN ('pending','approaching')`,
          lt(table.due_date, todayStr),
        ),
      )
      .returning({ id: table.id });
    result.overdue_count += upd.length;
    if (upd.length > 0) logger.info({ table: label, count: upd.length }, 'overdue');
  }

  logger.info({ ...result }, 'update-statuses completed');
  return result;
}
