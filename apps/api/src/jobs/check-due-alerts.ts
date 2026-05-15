/**
 * check-due-alerts cron — günde bir, 09:30 TR.
 *
 * Vadesine 7 / 3 / 1 / 0 gün kalan çek/senet için admin'lere bildirim.
 * Outgoing çekler kritik: vadeden önce hesapta para olmalı.
 */
import { and, eq, sql } from 'drizzle-orm';
import {
  checksAndNotes,
  getDb,
  tenants,
} from '@sayman/db';
import { logger } from '../config/logger';
import { createNotificationForAdmins } from './helpers';

export interface CheckDueAlertResult {
  attempted: number;
  alerted: number;
}

const WINDOWS = [0, 1, 3, 7]; // gün

export async function runCheckDueAlerts(): Promise<CheckDueAlertResult> {
  const result: CheckDueAlertResult = { attempted: 0, alerted: 0 };
  const db = getDb();
  const today = new Date();

  const allTenants = await db
    .select({ id: tenants.id, organization_id: tenants.organization_id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.is_active, true));

  for (const t of allTenants) {
    for (const days of WINDOWS) {
      const target = new Date(today);
      target.setDate(today.getDate() + days);
      const targetISO = target.toISOString().slice(0, 10);

      const checks = await db
        .select()
        .from(checksAndNotes)
        .where(
          and(
            eq(checksAndNotes.tenant_id, t.id),
            eq(checksAndNotes.is_active, true),
            eq(checksAndNotes.due_date, targetISO),
            sql`${checksAndNotes.status} IN ('portfolio', 'deposited', 'issued')`,
          ),
        );

      for (const c of checks) {
        result.attempted++;
        const amount = Number(c.amount).toLocaleString('tr-TR', {
          style: 'currency',
          currency: c.currency,
        });
        const dirLabel = c.direction === 'outgoing' ? '⚠️ ÖDEMEMİZ GEREKEN' : '💰 TAHSİL EDİLECEK';
        const kindLabel = c.kind === 'check' ? 'Çek' : 'Senet';
        const counterpart =
          c.direction === 'outgoing' ? c.beneficiary_name : c.drawer_name;

        const title =
          days === 0
            ? `${dirLabel} ${kindLabel} BUGÜN vadesi`
            : `${dirLabel} ${kindLabel} ${days} gün sonra`;

        const body = `${kindLabel} #${c.document_no ?? c.id.slice(0, 8)} — ${counterpart ?? '?'} · ${amount} · Vade: ${c.due_date}`;

        try {
          const r = await createNotificationForAdmins({
            organizationId: t.organization_id,
            tenantId: t.id,
            dedupeKey: `check_due:${c.id}:${days}`,
            title,
            body,
            category: 'payable_due',
            priority: days === 0 ? 'critical' : days <= 3 ? 'warning' : 'info',
            relatedTable: 'checks_and_notes',
            relatedId: c.id,
            actionUrl: '/checks',
          });
          if (r.created > 0) result.alerted++;
        } catch (err) {
          logger.error({ err, checkId: c.id }, 'check due alert failed');
        }
      }
    }
  }

  logger.info(result, 'check-due-alerts completed');
  return result;
}
