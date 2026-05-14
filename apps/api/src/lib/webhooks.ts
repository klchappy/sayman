/**
 * Webhook dispatch helper.
 *
 * dispatchWebhook(orgId, event, payload):
 *   - org'a kayıtlı active endpoint'lerden eventi destekleyenleri bul
 *   - Her biri için webhook_deliveries kaydı oluştur (pending)
 *   - Worker (cron) HTTP POST yapar
 *
 * Sync delivery yerine kuyruk pattern'i — boot esnasında downstream yavaşsa
 * caller bloklanmasın.
 */
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, webhookDeliveries, webhookEndpoints } from '@sayman/db';
import { logger } from '../config/logger';

export type WebhookEvent =
  | 'payable.created'
  | 'payable.updated'
  | 'payable.paid'
  | 'guarantee.created'
  | 'guarantee.expiring'
  | 'subscription.commitment_ending'
  | 'subsidiary.created'
  | 'tenant.created';

export async function dispatchWebhook(
  organizationId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<{ enqueued: number }> {
  const db = getDb();
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.organization_id, organizationId),
        eq(webhookEndpoints.is_active, true),
        sql`${event} = ANY(${webhookEndpoints.events})`,
      ),
    );

  if (endpoints.length === 0) return { enqueued: 0 };

  await db.insert(webhookDeliveries).values(
    endpoints.map((ep) => ({
      endpoint_id: ep.id,
      event,
      payload,
      status: 'pending',
      next_retry_at: new Date(),
    })),
  );

  logger.debug({ organizationId, event, count: endpoints.length }, 'webhooks enqueued');
  return { enqueued: endpoints.length };
}

export function signPayload(payload: unknown, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
