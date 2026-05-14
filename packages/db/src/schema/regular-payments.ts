/**
 * regular_payment_profiles — Kira ve düzenli ödeme sözleşmeleri.
 * Anayasa Madde 5.12 (Kira) + benzer sabit giderler.
 *
 * Bir sözleşme: landlord (kira veren) ↔ payer (kiracı) + property.
 * Aylık matris view layer'da; DB'de sadece profile + periodlar.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies, persons, properties } from './parties';
import { ownerTypeEnum, payableStatusEnum } from './enums';
import { payableItems } from './finance';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';

export const paymentKindEnum = pgEnum('regular_payment_kind', [
  'rent',          // kira
  'maintenance',   // bakım/yönetim
  'subscription',  // sabit abonelik (telekom dışı)
  'lease',         // leasing
  'other',
]);

export const regularPaymentProfiles = pgTable(
  'regular_payment_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    kind: paymentKindEnum('kind').notNull().default('rent'),
    title: text('title').notNull(),

    /** Kira veren (landlord) */
    landlord_owner_type: ownerTypeEnum('landlord_owner_type'),
    landlord_company_id: uuid('landlord_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    landlord_person_id: uuid('landlord_person_id').references(() => persons.id, {
      onDelete: 'set null',
    }),

    /** Kiracı (payer) */
    payer_owner_type: ownerTypeEnum('payer_owner_type'),
    payer_company_id: uuid('payer_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    payer_person_id: uuid('payer_person_id').references(() => persons.id, {
      onDelete: 'set null',
    }),

    property_id: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),

    /** Tenant içinde yan şirket / şube (Faz M) — opsiyonel */
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),

    start_date: date('start_date'),
    end_date: date('end_date'),
    monthly_amount: numeric('monthly_amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),
    payment_day: integer('payment_day').notNull().default(1),

    /** Yıllık artış oranı (%) */
    annual_increase_rate: numeric('annual_increase_rate', { precision: 5, scale: 2 }),
    next_increase_date: date('next_increase_date'),

    notes: text('notes'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_rpp_tenant').on(table.tenant_id),
    kindIdx: index('idx_rpp_kind').on(table.tenant_id, table.kind),
  }),
);

/**
 * Aylık dönem kayıtları. payable_items'a optional FK ile bağlanır
 * (ödeme yapıldığında payable oluşur).
 */
export const regularPaymentPeriods = pgTable(
  'regular_payment_periods',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    profile_id: uuid('profile_id')
      .notNull()
      .references(() => regularPaymentProfiles.id, { onDelete: 'cascade' }),

    /** yyyy-mm */
    period_label: text('period_label').notNull(),
    due_date: date('due_date'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    status: payableStatusEnum('status').notNull().default('pending'),

    payable_id: uuid('payable_id').references(() => payableItems.id, { onDelete: 'set null' }),

    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    profileIdx: index('idx_rpperiod_profile').on(table.profile_id),
    periodIdx: index('idx_rpperiod_period').on(table.tenant_id, table.period_label),
  }),
);

export type RegularPaymentProfile = typeof regularPaymentProfiles.$inferSelect;
export type NewRegularPaymentProfile = typeof regularPaymentProfiles.$inferInsert;
export type RegularPaymentPeriod = typeof regularPaymentPeriods.$inferSelect;
