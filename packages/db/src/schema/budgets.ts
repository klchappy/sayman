/**
 * budgets — Kategori bazlı aylık/quarterly/yıllık bütçe planlama.
 *
 * Tenant her kategori için planlanan tutar belirler ("elektrik = 5000 TL/ay").
 * Cron veya kullanıcı tıkladığında gerçekleşen tutar payable_items'tan çıkarılır,
 * aşılma %80'i geçince uyarı tetiklenir.
 *
 * period_kind:
 *   'monthly'  → period = '2026-05'
 *   'quarterly' → period = '2026-Q2'
 *   'yearly'   → period = '2026'
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** PayableCategory veya 'all' / custom etiket */
    category: text('category').notNull(),
    /** 'monthly' | 'quarterly' | 'yearly' */
    period_kind: text('period_kind').notNull().default('monthly'),
    period: text('period').notNull(),
    planned_amount: numeric('planned_amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),
    /** Aşılma uyarısı yüzdesi (default 80) */
    alert_threshold_pct: numeric('alert_threshold_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('80'),
    /** Son uyarı bildirimi yollandı mı (idempotent) */
    alerted_at: timestamp('alerted_at', { withTimezone: true }),
    notes: text('notes'),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_budgets_tenant').on(table.tenant_id, table.period),
    uq: uniqueIndex('uq_budgets_tenant_category_period').on(
      table.tenant_id,
      table.category,
      table.period,
    ),
  }),
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
