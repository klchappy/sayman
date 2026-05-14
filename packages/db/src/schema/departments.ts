/**
 * departments — organization içi gruplar (tenants'tan farklı kavram).
 *
 * Sayman'da:
 *   organization = SaaS müşterisi (holding)
 *   tenant       = sektör (Tekstil, Enerji, ...)
 *   department   = organization içi yönetimsel grup (Muhasebe, Satış, ...)
 *
 * Departments tenant'lardan bağımsızdır; bir muhasebe departmanı
 * birden çok sektörde çalışabilir.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    is_default: boolean('is_default').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_departments_org').on(table.organization_id),
    uniqueSlug: uniqueIndex('uniq_departments_org_slug').on(table.organization_id, table.slug),
  }),
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

/** Yeni organization oluşturulurken otomatik insert edilen 7 default departman. */
export const DEFAULT_DEPARTMENTS = [
  { name: 'Yönetim', slug: 'yonetim', color: '#0ea5e9', is_default: true },
  { name: 'Satış', slug: 'satis', color: '#22c55e', is_default: false },
  { name: 'Pazarlama', slug: 'pazarlama', color: '#f59e0b', is_default: false },
  { name: 'Finans', slug: 'finans', color: '#8b5cf6', is_default: false },
  { name: 'İK', slug: 'ik', color: '#ec4899', is_default: false },
  { name: 'Operasyon', slug: 'operasyon', color: '#06b6d4', is_default: false },
  { name: 'Teknoloji', slug: 'teknoloji', color: '#64748b', is_default: false },
] as const;
