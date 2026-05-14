/**
 * webhook_endpoints + webhook_deliveries — outbound webhook altyapısı.
 *
 * Senaryo: 3rd-party servis (Damga, n8n, Zapier) Sayman'da yeni payable/teminat
 * oluşunca otomatik HTTP POST almak istiyor.
 *
 *   1. Org admin /webhooks UI'dan yeni endpoint ekler (URL + secret + event'ler)
 *   2. Sayman içinde olaylar tetiklenir → webhook_deliveries kuyruğuna düşer
 *   3. Worker (cron 1 dk) pending delivery'leri HTTP POST eder + retry
 *   4. HMAC-SHA256 imza header'da (X-Sayman-Signature) — receiver doğrular
 *
 * Event tipleri:
 *   payable.created / payable.updated / payable.paid
 *   guarantee.created / guarantee.expiring (T-30)
 *   subscription.commitment_ending (T-30)
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    url: text('url').notNull(),
    /** HMAC için secret (UI'da bir kez gösterilir, sonra masked) */
    secret: text('secret').notNull(),

    /** Hangi event'ler ('payable.created', 'guarantee.expiring', vb.) */
    events: text('events').array().notNull().default(sql`'{}'::text[]`),

    is_active: boolean('is_active').notNull().default(true),

    /** Son denemenin sonucu — debug için */
    last_status: integer('last_status'),
    last_error: text('last_error'),
    last_called_at: timestamp('last_called_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_webhook_endpoints_org').on(table.organization_id),
  }),
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpoint_id: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),

    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),

    status: text('status').notNull().default('pending'), // pending | success | failed
    attempts: integer('attempts').notNull().default(0),
    last_status_code: integer('last_status_code'),
    last_error: text('last_error'),
    next_retry_at: timestamp('next_retry_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => ({
    endpointIdx: index('idx_webhook_deliveries_endpoint').on(table.endpoint_id),
    statusIdx: index('idx_webhook_deliveries_status').on(table.status, table.next_retry_at),
  }),
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
