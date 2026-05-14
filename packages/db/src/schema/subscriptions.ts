/**
 * subscriptions — Abonelik & Taahhüt (Anayasa Madde 5.7).
 *
 * Tenant-scope. Bir abonelik: kurum (TT/CK/İGDAŞ) ← sahip (şirket/şahıs) ile
 * mülk üzerinde aktif.
 *
 * commitment_end_date dolduğunda Notification cron (sonraki faz) T-60/T-30/T-7
 * uyarı üretir.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies, institutions, persons, properties } from './parties';
import { ownerTypeEnum } from './enums';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'on_hold',
  'cancelled',
  'expired',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    institution_id: uuid('institution_id').references(() => institutions.id, {
      onDelete: 'set null',
    }),
    owner_type: ownerTypeEnum('owner_type').notNull().default('company'),
    company_id: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    person_id: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    property_id: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    /** Tenant içinde yan şirket / şube (Faz M) — opsiyonel */
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),

    subscription_no: text('subscription_no'),
    package_name: text('package_name'),
    auto_payment: boolean('auto_payment').notNull().default(false),

    monthly_amount: numeric('monthly_amount', { precision: 15, scale: 2 }),
    currency: text('currency').notNull().default('TRY'),

    start_date: date('start_date'),
    end_date: date('end_date'),
    commitment_end_date: date('commitment_end_date'),
    cancellation_penalty: numeric('cancellation_penalty', { precision: 15, scale: 2 }),

    status: subscriptionStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),

    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_subscriptions_tenant').on(table.tenant_id),
    commitmentIdx: index('idx_subscriptions_commitment').on(table.commitment_end_date),
    statusIdx: index('idx_subscriptions_status').on(table.tenant_id, table.status),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
