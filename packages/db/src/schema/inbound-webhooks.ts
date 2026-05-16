/**
 * inbound_webhook_endpoints + inbound_webhook_events
 *
 * Damga/n8n/Zapier → Sayman'a POST.
 *
 * Akış:
 *   1. Admin /webhooks/inbound UI'dan endpoint oluşturur (slug + secret + tip)
 *   2. Sayman tarafından unique URL üretilir: /v1/inbound/:slug
 *   3. Caller HMAC imzalı POST atar
 *   4. Sayman event'i alır, tipine göre işler (payable_create, vb.)
 *
 * Şu an "payable_create" tipi destekli; istek body'sini payable_items'a insert.
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { tenants } from './tenants';

export const inboundWebhookEndpoints = pgTable(
  'inbound_webhook_endpoints',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** URL içinde geçer: /v1/inbound/:slug — global unique */
    slug: text('slug').notNull(),
    /** HMAC-SHA256 secret (Header X-Sayman-Inbound-Signature ile doğrulanır) */
    secret: text('secret').notNull(),

    /** Hangi event tipini bekliyor: 'payable_create' | 'invoice_xml' | 'generic' */
    event_type: text('event_type').notNull().default('payable_create'),

    is_active: boolean('is_active').notNull().default(true),
    last_called_at: timestamp('last_called_at', { withTimezone: true }),
    call_count: integer('call_count').notNull().default(0),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugUq: uniqueIndex('uq_inbound_slug').on(table.slug),
    orgIdx: index('idx_inbound_org').on(table.organization_id),
  }),
);

export const inboundWebhookEvents = pgTable(
  'inbound_webhook_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    endpoint_id: uuid('endpoint_id')
      .notNull()
      .references(() => inboundWebhookEndpoints.id, { onDelete: 'cascade' }),

    payload: jsonb('payload').notNull(),
    /** Sonuç: 'processed' | 'rejected' | 'error' */
    status: text('status').notNull().default('received'),
    /** Yarattığı kaydın id'si (payable_id vb.) */
    created_record_id: uuid('created_record_id'),
    error_message: text('error_message'),

    /** Idempotency: caller X-Idempotency-Key header'ı geçerse aynı key'le ikinci
     * çağrı duplicate kabul edilir (uniqueIndex DB seviyesinde garanti). */
    idempotency_key: text('idempotency_key'),

    received_at: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processed_at: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    endpointIdx: index('idx_inbound_events_endpoint').on(table.endpoint_id, table.received_at),
    idempotencyUq: uniqueIndex('uniq_inbound_idempotency')
      .on(table.endpoint_id, table.idempotency_key)
      .where(sql`idempotency_key IS NOT NULL`),
  }),
);

export type InboundWebhookEndpoint = typeof inboundWebhookEndpoints.$inferSelect;
export type NewInboundWebhookEndpoint = typeof inboundWebhookEndpoints.$inferInsert;
export type InboundWebhookEvent = typeof inboundWebhookEvents.$inferSelect;
