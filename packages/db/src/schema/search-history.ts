/**
 * search_history — kullanıcının arama geçmişi (last N + frequency).
 *
 * Kullanım:
 *   - Cmd+K açıldığında boş input'a son N arama gösterilir (recent)
 *   - En çok aranan ifadeler suggestion olarak öne çıkar
 *
 * Idempotent değil — her arama yeni satır. Cron veya endpoint ile eski kayıtlar
 * temizlenir (örn 30 günden eski).
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    /** Hangi tenant'ta arandı (analiz için) */
    tenant_id: uuid('tenant_id'),
    /** Sonuç sayısı (rapor için) */
    result_count: integer('result_count').notNull().default(0),
    /** Sorgu süresi (ms) */
    duration_ms: integer('duration_ms').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_search_history_user').on(table.user_id, table.created_at),
    queryIdx: index('idx_search_history_query').on(table.query),
  }),
);

export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
