/**
 * tax_calendar_events — Türkiye'ye özgü vergi takvimi.
 *
 * Aylık/üç aylık/yıllık beyanname ve ödeme tarihleri otomatik task'a dönüşür.
 * Cron her ayın 1'inde gelecek 60 günün event'lerini idempotent yaratır
 * (kind + period + tenant_id unique).
 *
 * Türkiye vergi takvimi (sabit):
 *   - KDV beyanname: her ayın 26'sı (önceki ay)
 *   - Muhtasar + Prim Hizmet Beyannamesi: her ayın 26'sı
 *   - Geçici vergi beyanname: Şub 14, May 14, Ağu 14, Kas 14
 *   - Kurumlar vergisi beyanname: Nisan 25
 *   - MTV: Ocak ve Temmuz sonu
 *   - BAĞ-KUR primi: ay sonu
 *   - SGK primi: ay sonu (özel sektör 23, kamu 7)
 *   - Damga vergisi: ay sonu
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const taxCalendarEvents = pgTable(
  'tax_calendar_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'kdv' | 'muhtasar' | 'gecici_vergi' | 'kurumlar_vergisi' | 'mtv' | 'bagkur' | 'sgk' | 'damga' | 'custom' */
    kind: text('kind').notNull(),
    /** İnsan-okur etiket: "Mayıs 2026 KDV Beyannamesi" */
    label: text('label').notNull(),
    /** Hangi dönem: '2026-05' (KDV için), '2026-Q1' (geçici vergi için) */
    period: text('period').notNull(),
    /** Son ödeme/beyanname tarihi */
    due_date: date('due_date').notNull(),
    /** Tahmini tutar — kullanıcı manuel girer, opsiyonel */
    estimated_amount: numeric('estimated_amount', { precision: 15, scale: 2 }),
    /** 'pending' | 'submitted' | 'paid' | 'late' | 'cancelled' */
    status: text('status').notNull().default('pending'),
    notes: text('notes'),
    is_active: boolean('is_active').notNull().default(true),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDueIdx: index('idx_tax_calendar_tenant_due').on(table.tenant_id, table.due_date),
    kindPeriodUq: uniqueIndex('uq_tax_calendar_kind_period').on(
      table.tenant_id,
      table.kind,
      table.period,
    ),
  }),
);

export type TaxCalendarEvent = typeof taxCalendarEvents.$inferSelect;
export type NewTaxCalendarEvent = typeof taxCalendarEvents.$inferInsert;
