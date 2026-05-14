/**
 * category_feedback — Kullanıcı kategori düzeltmeleri (öğrenen sistem zemini).
 *
 * suggestCategory yanlış öneri verdiğinde kullanıcı manuel kategoriye geçer.
 * Bu kayıt → ileride keyword listesini genişletmek için tarama yapılır.
 * Şu an basit log; pgvector embedding'le birleştirilince fine-tune zemini olur.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const categoryFeedback = pgTable(
  'category_feedback',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Hangi payable üzerinden düzeltme */
    payable_id: uuid('payable_id'),
    /** suggestCategory'nin önerisi */
    suggested_category: text('suggested_category'),
    /** Kullanıcı tarafından seçilen */
    actual_category: text('actual_category').notNull(),
    /** Eşleşme yapılan başlık/supplier kombinasyonu */
    source_text: text('source_text'),

    user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_category_feedback_tenant').on(table.tenant_id),
    actualIdx: index('idx_category_feedback_actual').on(table.actual_category),
  }),
);

export type CategoryFeedback = typeof categoryFeedback.$inferSelect;
export type NewCategoryFeedback = typeof categoryFeedback.$inferInsert;
