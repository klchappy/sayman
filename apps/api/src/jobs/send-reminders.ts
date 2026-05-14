/**
 * send-reminders cron job — daily 09:00 TR.
 *
 * Yaklaşan tarihleri tara, her bir admin user için:
 *   - subscriptions.commitment_end_date T-60/T-30/T-7  → mail
 *   - guarantees.expiry_date T-60/T-30/T-7              → mail
 *   - payable_items.due_date T-7/T-1                    → mail
 *   - regular_payment_periods.due_date T-7/T-1          → mail
 *   - official_payment_periods.due_date T-7/T-1         → mail
 *
 * Idempotent: notifications.dedupe_key = "{resource_type}:{id}:{T-N}:{date}:{user_id}"
 */
import { and, eq, isNull } from 'drizzle-orm';
import {
  getDb,
  guarantees,
  officialPaymentPeriods,
  payableItems,
  regularPaymentPeriods,
  subscriptions,
  tenants,
} from '@sayman/db';
import { logger } from '../config/logger';
import { createNotificationForAdmins, plusDays, todayISO } from './helpers';

export interface ReminderResult {
  subscriptions_notified: number;
  guarantees_notified: number;
  payables_notified: number;
  regular_notified: number;
  official_notified: number;
  mail_sent: number;
}

const SUBSCRIPTION_OFFSETS = [60, 30, 7];
const GUARANTEE_OFFSETS = [60, 30, 7];
const PAYABLE_OFFSETS = [7, 1];

export async function runSendReminders(): Promise<ReminderResult> {
  const result: ReminderResult = {
    subscriptions_notified: 0,
    guarantees_notified: 0,
    payables_notified: 0,
    regular_notified: 0,
    official_notified: 0,
    mail_sent: 0,
  };

  const today = new Date();

  // --- Subscriptions: commitment_end_date ---
  for (const offset of SUBSCRIPTION_OFFSETS) {
    const targetDate = plusDays(today, offset);
    const db = getDb();
    const rows = await db
      .select({
        id: subscriptions.id,
        tenant_id: subscriptions.tenant_id,
        package_name: subscriptions.package_name,
        commitment_end_date: subscriptions.commitment_end_date,
        organization_id: tenants.organization_id,
      })
      .from(subscriptions)
      .innerJoin(tenants, eq(tenants.id, subscriptions.tenant_id))
      .where(
        and(
          eq(subscriptions.commitment_end_date, targetDate),
          eq(subscriptions.is_active, true),
          eq(subscriptions.status, 'active'),
        ),
      );

    for (const r of rows) {
      const res = await createNotificationForAdmins({
        organizationId: r.organization_id,
        tenantId: r.tenant_id,
        dedupeKey: `subscription:${r.id}:T-${offset}:${targetDate}`,
        title: `Abonelik taahhüt bitiyor (T-${offset} gün)`,
        body: `"${r.package_name ?? 'Abonelik'}" sözleşmesinin taahhüt süresi ${r.commitment_end_date} tarihinde doluyor. İptal/yenileme kararı verme zamanı.`,
        category: 'payable_due',
        priority: offset <= 7 ? 'critical' : offset <= 30 ? 'warning' : 'info',
        relatedTable: 'subscriptions',
        relatedId: r.id,
        actionUrl: '/subscriptions',
      });
      result.subscriptions_notified += res.created;
      result.mail_sent += res.mail_sent;
    }
  }

  // --- Guarantees: expiry_date ---
  for (const offset of GUARANTEE_OFFSETS) {
    const targetDate = plusDays(today, offset);
    const db = getDb();
    const rows = await db
      .select({
        id: guarantees.id,
        tenant_id: guarantees.tenant_id,
        beneficiary_name: guarantees.beneficiary_name,
        letter_no: guarantees.letter_no,
        expiry_date: guarantees.expiry_date,
        organization_id: tenants.organization_id,
      })
      .from(guarantees)
      .innerJoin(tenants, eq(tenants.id, guarantees.tenant_id))
      .where(
        and(
          eq(guarantees.expiry_date, targetDate),
          eq(guarantees.is_active, true),
          eq(guarantees.status, 'active'),
        ),
      );

    for (const r of rows) {
      const res = await createNotificationForAdmins({
        organizationId: r.organization_id,
        tenantId: r.tenant_id,
        dedupeKey: `guarantee:${r.id}:T-${offset}:${targetDate}`,
        title: `Teminat mektubu süresi doluyor (T-${offset} gün)`,
        body: `${r.beneficiary_name} lehine düzenlenen teminat mektubu${r.letter_no ? ` (#${r.letter_no})` : ''} ${r.expiry_date} tarihinde bitiyor.`,
        category: 'payable_due',
        priority: offset <= 7 ? 'critical' : offset <= 30 ? 'warning' : 'info',
        relatedTable: 'guarantees',
        relatedId: r.id,
        actionUrl: '/guarantees',
      });
      result.guarantees_notified += res.created;
      result.mail_sent += res.mail_sent;
    }
  }

  // --- Payables: due_date T-7/T-1 ---
  for (const offset of PAYABLE_OFFSETS) {
    const targetDate = plusDays(today, offset);
    const db = getDb();
    const rows = await db
      .select({
        id: payableItems.id,
        tenant_id: payableItems.tenant_id,
        title: payableItems.title,
        amount: payableItems.amount,
        due_date: payableItems.due_date,
        organization_id: tenants.organization_id,
      })
      .from(payableItems)
      .innerJoin(tenants, eq(tenants.id, payableItems.tenant_id))
      .where(
        and(
          eq(payableItems.due_date, targetDate),
          eq(payableItems.is_active, true),
        ),
      );

    for (const r of rows) {
      const res = await createNotificationForAdmins({
        organizationId: r.organization_id,
        tenantId: r.tenant_id,
        dedupeKey: `payable:${r.id}:T-${offset}:${targetDate}`,
        title: `Fatura vade${offset === 1 ? 'si yarın' : `si ${offset} gün sonra`}`,
        body: `"${r.title}" — ${r.amount} TL, vade ${r.due_date}.`,
        category: 'payable_due',
        priority: offset === 1 ? 'critical' : 'warning',
        relatedTable: 'payable_items',
        relatedId: r.id,
        actionUrl: `/payables/${r.id}`,
      });
      result.payables_notified += res.created;
      result.mail_sent += res.mail_sent;
    }
  }

  // --- Regular payment periods T-7/T-1 ---
  for (const offset of PAYABLE_OFFSETS) {
    const targetDate = plusDays(today, offset);
    const db = getDb();
    const rows = await db
      .select({
        id: regularPaymentPeriods.id,
        tenant_id: regularPaymentPeriods.tenant_id,
        period_label: regularPaymentPeriods.period_label,
        amount: regularPaymentPeriods.amount,
        due_date: regularPaymentPeriods.due_date,
        organization_id: tenants.organization_id,
      })
      .from(regularPaymentPeriods)
      .innerJoin(tenants, eq(tenants.id, regularPaymentPeriods.tenant_id))
      .where(
        and(
          eq(regularPaymentPeriods.due_date, targetDate),
          eq(regularPaymentPeriods.status, 'pending'),
        ),
      );

    for (const r of rows) {
      const res = await createNotificationForAdmins({
        organizationId: r.organization_id,
        tenantId: r.tenant_id,
        dedupeKey: `rp_period:${r.id}:T-${offset}:${targetDate}`,
        title: `Kira/Düzenli ödeme vade${offset === 1 ? 'si yarın' : `si ${offset} gün sonra`}`,
        body: `${r.period_label} dönemi, ${r.amount} TL. Vade ${r.due_date}.`,
        category: 'payable_due',
        priority: offset === 1 ? 'critical' : 'warning',
        relatedTable: 'regular_payment_periods',
        relatedId: r.id,
        actionUrl: '/regular-payments',
      });
      result.regular_notified += res.created;
      result.mail_sent += res.mail_sent;
    }
  }

  // --- Official payment periods T-7/T-1 ---
  for (const offset of PAYABLE_OFFSETS) {
    const targetDate = plusDays(today, offset);
    const db = getDb();
    const rows = await db
      .select({
        id: officialPaymentPeriods.id,
        tenant_id: officialPaymentPeriods.tenant_id,
        period_label: officialPaymentPeriods.period_label,
        amount: officialPaymentPeriods.amount,
        due_date: officialPaymentPeriods.due_date,
        organization_id: tenants.organization_id,
      })
      .from(officialPaymentPeriods)
      .innerJoin(tenants, eq(tenants.id, officialPaymentPeriods.tenant_id))
      .where(
        and(
          eq(officialPaymentPeriods.due_date, targetDate),
          eq(officialPaymentPeriods.status, 'pending'),
        ),
      );

    for (const r of rows) {
      const res = await createNotificationForAdmins({
        organizationId: r.organization_id,
        tenantId: r.tenant_id,
        dedupeKey: `op_period:${r.id}:T-${offset}:${targetDate}`,
        title: `Resmi ödeme vade${offset === 1 ? 'si yarın' : `si ${offset} gün sonra`}`,
        body: `${r.period_label} dönemi, ${r.amount} TL. Vade ${r.due_date}.`,
        category: 'payable_due',
        priority: offset === 1 ? 'critical' : 'warning',
        relatedTable: 'official_payment_periods',
        relatedId: r.id,
        actionUrl: '/official-payments',
      });
      result.official_notified += res.created;
      result.mail_sent += res.mail_sent;
    }
  }

  logger.info({ ...result }, 'send-reminders completed');
  return result;
}
