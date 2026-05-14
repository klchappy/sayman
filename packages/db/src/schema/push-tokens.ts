/**
 * push_tokens — Capacitor / FCM / APNs cihaz token kaydı.
 *
 * Kullanıcı mobil app'i ilk açtığında token kaydolur. Bir kullanıcının
 * birden çok cihazı olabilir (iPhone + iPad gibi).
 *
 * Notification cron + manual notification senderları bu tabloya bakar.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'ios' | 'android' | 'web' */
    platform: text('platform').notNull(),
    /** Firebase Cloud Messaging registration token (Android + Web), Apple device token (iOS) */
    token: text('token').notNull(),
    /** Native bundle build identifier (debug için) */
    app_version: text('app_version'),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_push_tokens_user').on(table.user_id),
    tokenUq: uniqueIndex('uq_push_tokens_token').on(table.token),
  }),
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
