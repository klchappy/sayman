/**
 * sync-erp-connections cron — saatlik.
 *
 * Active + sync_interval_hours geçmiş bağlantıları sırayla sync eder.
 * Aynı anda birden fazla sync olmasını engellemek için sequential döngü.
 *
 * Idempotent: sync_count + last_sync_at her sync sonunda update.
 */
import { and, eq, sql } from 'drizzle-orm';
import { erpConnections, getDb } from '@sayman/db';
import { logger } from '../config/logger';
import { runFullSync } from '../lib/erp/runner';

export interface ErpSyncCronResult {
  attempted: number;
  success: number;
  partial: number;
  failed: number;
}

export async function runSyncErpConnections(): Promise<ErpSyncCronResult> {
  const result: ErpSyncCronResult = {
    attempted: 0,
    success: 0,
    partial: 0,
    failed: 0,
  };

  const db = getDb();

  // active + (last_sync_at NULL OR last_sync_at + sync_interval_hours < NOW())
  const due = await db
    .select({ id: erpConnections.id, name: erpConnections.name })
    .from(erpConnections)
    .where(
      and(
        eq(erpConnections.status, 'active'),
        sql`(
          ${erpConnections.last_sync_at} IS NULL
          OR ${erpConnections.last_sync_at} + (${erpConnections.sync_interval_hours} || ' hours')::interval < NOW()
        )`,
        sql`${erpConnections.sync_interval_hours}::numeric > 0`,
      ),
    )
    .limit(20);

  for (const conn of due) {
    result.attempted++;
    try {
      const r = await runFullSync(conn.id, 'cron');
      if (r.status === 'success') result.success++;
      else if (r.status === 'partial') result.partial++;
      else result.failed++;
    } catch (err) {
      logger.error({ err, connectionId: conn.id, name: conn.name }, 'ERP cron sync failed');
      result.failed++;
    }
  }

  if (result.attempted > 0) logger.info(result, 'sync-erp-connections completed');
  return result;
}
