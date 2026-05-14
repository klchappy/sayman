/**
 * deliver-webhooks cron job — her dakika çalışır.
 *
 * webhook_deliveries kuyruğundaki pending kayıtları HTTP POST eder.
 * Retry: 1, 5, 15, 60 dk sonra; 4 deneme sonrası status='failed'.
 *
 * HMAC-SHA256 imza: X-Sayman-Signature header'da.
 * Receiver: aynı secret ile body'yi imzalayıp eşleştirir.
 */
import { and, eq, lte, sql } from 'drizzle-orm';
import { getDb, webhookDeliveries, webhookEndpoints } from '@sayman/db';
import { logger } from '../config/logger';
import { signPayload } from '../lib/webhooks';

const MAX_ATTEMPTS = 4;
const RETRY_MINUTES = [1, 5, 15, 60];
const DELIVERY_TIMEOUT_MS = 10_000;
const BATCH_LIMIT = 50;

export interface WebhookWorkerResult {
  delivered: number;
  failed: number;
  retried: number;
}

export async function runDeliverWebhooks(): Promise<WebhookWorkerResult> {
  const result: WebhookWorkerResult = { delivered: 0, failed: 0, retried: 0 };
  const db = getDb();
  const now = new Date();

  const pending = await db
    .select({
      delivery: webhookDeliveries,
      endpoint: webhookEndpoints,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpoint_id))
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        sql`${webhookDeliveries.next_retry_at} <= ${now}`,
        eq(webhookEndpoints.is_active, true),
      ),
    )
    .limit(BATCH_LIMIT);

  for (const { delivery, endpoint } of pending) {
    const signature = signPayload(delivery.payload, endpoint.secret);
    let statusCode: number | null = null;
    let errorText: string | null = null;

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      const resp = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sayman-Event': delivery.event,
          'X-Sayman-Signature': `sha256=${signature}`,
          'X-Sayman-Delivery': delivery.id,
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });
      clearTimeout(t);
      statusCode = resp.status;
      if (!resp.ok) errorText = `HTTP ${resp.status}`;
    } catch (e) {
      errorText = (e as Error).message;
    }

    const attempts = delivery.attempts + 1;

    if (!errorText) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'success',
          attempts,
          last_status_code: statusCode,
          last_error: null,
          delivered_at: new Date(),
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await db
        .update(webhookEndpoints)
        .set({
          last_status: statusCode,
          last_error: null,
          last_called_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpoint.id));
      result.delivered++;
    } else if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'failed',
          attempts,
          last_status_code: statusCode,
          last_error: errorText,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      await db
        .update(webhookEndpoints)
        .set({
          last_status: statusCode,
          last_error: errorText,
          last_called_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpoint.id));
      result.failed++;
    } else {
      const retryMin = RETRY_MINUTES[attempts - 1] ?? 60;
      const nextRetry = new Date(Date.now() + retryMin * 60_000);
      await db
        .update(webhookDeliveries)
        .set({
          attempts,
          last_status_code: statusCode,
          last_error: errorText,
          next_retry_at: nextRetry,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      result.retried++;
    }
  }

  if (pending.length > 0) {
    logger.info({ ...result, processed: pending.length }, 'deliver-webhooks');
  }
  return result;
}
