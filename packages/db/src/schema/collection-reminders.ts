/**
 * collection_reminders — Geciken alacak için otomatik tahsilat hatırlatma kuralları.
 *
 * Bir sales_invoice'ın vadesi geçince Sayman'ın müşteriye otomatik mesaj atması:
 *   - email (Resend ile)
 *   - WhatsApp (eğer customer phone varsa + WhatsApp config'liyse)
 *   - telegram (eğer ilgili kullanıcının chat_id'si varsa)
 *
 * Per-sales-invoice değil, per-tenant kural seti:
 *   "3 gün geçince hafif", "10 gün geçince orta", "30 gün geçince sert"
 *
 * collection_reminder_runs — her gönderinin log'u (idempotent, dedup ile spam engellenir).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { salesInvoices } from './sales';
import { tenants } from './tenants';

export const collectionReminderRules = pgTable(
  'collection_reminder_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Vade gününden kaç gün sonra tetiklenecek (1, 7, 30 gibi) */
    days_after_due: numeric('days_after_due', { precision: 5 }).notNull(),
    /** 'email' | 'whatsapp' | 'telegram' */
    channel: text('channel').notNull().default('email'),
    /** Mesaj şablonu — placeholders: {{customer}}, {{amount}}, {{due_date}}, {{days_overdue}}, {{invoice_no}} */
    subject: text('subject'),
    body: text('body').notNull(),
    /** Minimum tutar — küçük alacaklılar için spam etmemek için */
    min_amount: numeric('min_amount', { precision: 15, scale: 2 }).default('0').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_collection_rules_tenant').on(table.tenant_id, table.is_active),
  }),
);

export const collectionReminderRuns = pgTable(
  'collection_reminder_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    rule_id: uuid('rule_id')
      .notNull()
      .references(() => collectionReminderRules.id, { onDelete: 'cascade' }),
    sales_invoice_id: uuid('sales_invoice_id')
      .notNull()
      .references(() => salesInvoices.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    /** 'sent' | 'failed' | 'skipped' */
    status: text('status').notNull(),
    error_message: text('error_message'),
    /** Gönderilen mesajın hash'i — günde 1 kez idempotent */
    dedupe_key: text('dedupe_key').notNull(),
    rendered_body: text('rendered_body'),
    delivery_id: text('delivery_id'),
    sent_at: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => ({
    dedupUq: uniqueIndex('uq_collection_reminder_dedup').on(table.dedupe_key),
    invoiceIdx: index('idx_collection_reminders_invoice').on(table.sales_invoice_id),
    tenantIdx: index('idx_collection_reminders_tenant').on(table.tenant_id, table.sent_at),
  }),
);

export type CollectionReminderRule = typeof collectionReminderRules.$inferSelect;
export type NewCollectionReminderRule = typeof collectionReminderRules.$inferInsert;
export type CollectionReminderRun = typeof collectionReminderRuns.$inferSelect;
export type NewCollectionReminderRun = typeof collectionReminderRuns.$inferInsert;
