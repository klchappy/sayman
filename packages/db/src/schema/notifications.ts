/**
 * notifications — sistem içi bildirim merkezi (PROJECT_ANAYASA Madde 8 + 5.17).
 *
 * User-scope (her bildirimin sahibi user). Bağlı kayıt için polimorfik FK.
 * Telegram gerçek gönderim Faz F'de aktif edilir; şu an dry-run.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const notificationCategoryEnum = pgEnum('notification_category', [
  'payable_due',         // vade yaklaşan/geciken fatura
  'task_assigned',
  'task_due',
  'system',              // sistem mesajları
  'security',            // login, 2fa, vb.
  'audit',
]);

export const notificationPriorityEnum = pgEnum('notification_priority', [
  'info',
  'warning',
  'critical',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Bildirim sahibi user */
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Hangi tenant context'inde — null = organization-level */
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    body: text('body'),
    category: notificationCategoryEnum('category').notNull().default('system'),
    priority: notificationPriorityEnum('priority').notNull().default('info'),

    /** Polimorfik bağlantı: hangi kayıttan üretildi */
    related_table: text('related_table'),
    related_id: uuid('related_id'),

    /** Sayman içinde tıklanırsa nereye gitsin */
    action_url: text('action_url'),

    metadata: jsonb('metadata').default({}).notNull(),

    /** Idempotency: gunde aynı kaynak+tip+gun icin tek bildirim. */
    dedupe_key: text('dedupe_key'),

    read_at: timestamp('read_at', { withTimezone: true }),
    dismissed_at: timestamp('dismissed_at', { withTimezone: true }),

    /** Telegram gönderim durumu (Faz N'de aktif) */
    telegram_mode: text('telegram_mode'),
    telegram_sent_at: timestamp('telegram_sent_at', { withTimezone: true }),

    /** Resend e-posta gönderim durumu (Faz J + I) */
    email_status: text('email_status'),
    email_sent_at: timestamp('email_sent_at', { withTimezone: true }),
    email_message_id: text('email_message_id'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_notifications_user').on(table.user_id, table.read_at),
    unreadIdx: index('idx_notifications_unread').on(table.user_id, table.created_at),
    tenantIdx: index('idx_notifications_tenant').on(table.tenant_id),
    relatedIdx: index('idx_notifications_related').on(table.related_table, table.related_id),
    dedupeUq: uniqueIndex('uq_notifications_dedupe').on(table.dedupe_key).where(sql`dedupe_key IS NOT NULL`),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
