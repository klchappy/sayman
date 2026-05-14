/**
 * subsidiaries — Tenant içinde "yan şirket / şube" katmanı (Faz M).
 *
 * Hiyerarşi:
 *   Organization (Kılıç Holding)
 *     └── Tenant (Kılıç İnşaat / Tekstil / vs.) — sektörel ayrım
 *           └── Subsidiary (İstanbul Şubesi / Mersin Şubesi / Genel Müdürlük)
 *
 * Kullanım:
 *   - Faturalar, abonelikler, teminatlar opsiyonel olarak bir subsidiary'e
 *     bağlanabilir (ileride mevcut tablolara subsidiary_id eklenecek).
 *   - Raporlama: tenant içinde subsidiary bazlı filtreleme.
 *   - self-referencing parent_subsidiary_id ile derin hiyerarşi (Holding → Şube → Alt birim).
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
import { tenants } from './tenants';

export const subsidiaries = pgTable(
  'subsidiaries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    /** Görünür ad — "Kılıç İnşaat İstanbul Şubesi" */
    name: text('name').notNull(),
    /** Kısa kod (URL/raporlarda) — "ist-sube" */
    code: text('code'),
    description: text('description'),

    /** Self-reference: alt yan-şirket. NULL → tenant kökünde. */
    parent_subsidiary_id: uuid('parent_subsidiary_id'),

    /** Görsel ipuçları — UI sıralama, ikon, renk */
    color: text('color'),
    sort_order: text('sort_order'),

    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_subsidiaries_tenant').on(table.tenant_id),
    parentIdx: index('idx_subsidiaries_parent').on(table.parent_subsidiary_id),
    // tenant + code → unique (boş code'lar partial ile dışta tutulur)
    codeUq: uniqueIndex('uq_subsidiaries_tenant_code')
      .on(table.tenant_id, table.code)
      .where(sql`code IS NOT NULL`),
  }),
);

export type Subsidiary = typeof subsidiaries.$inferSelect;
export type NewSubsidiary = typeof subsidiaries.$inferInsert;
