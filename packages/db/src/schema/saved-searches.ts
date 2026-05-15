/**
 * saved_searches — Kullanıcı per-modül kayıtlı filtreleri.
 *
 * Örnek: Payables sayfasında "Geciken 1000+ TL fiber faturalar" filtresini
 * isimle kaydet → bir sonraki ziyarette tek tıkla aynı filtre.
 *
 * is_pinned true → sayfa açılırken otomatik uygulanır.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'payables' | 'sales' | 'employees' | 'cari' | vb. */
    module: text('module').notNull(),
    name: text('name').notNull(),
    /** Filter parametreleri */
    filters: jsonb('filters').default({}).notNull(),
    is_pinned: boolean('is_pinned').default(false).notNull(),
    is_shared: boolean('is_shared').default(false).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userModuleIdx: index('idx_saved_searches_user').on(table.user_id, table.module),
    uq: uniqueIndex('uq_saved_searches_user_module_name').on(
      table.user_id,
      table.module,
      table.name,
    ),
  }),
);

export type SavedSearch = typeof savedSearches.$inferSelect;
export type NewSavedSearch = typeof savedSearches.$inferInsert;
