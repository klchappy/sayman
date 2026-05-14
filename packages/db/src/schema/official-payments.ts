/**
 * official_payments — BAĞKUR/SSK/BES/İTO/KGK/GELİR/KDV/MTV vb. resmi ödemeler.
 * Anayasa Madde 5.13.
 *
 * Bir profil: sahip (şirket veya şahıs) için periyodik ödeme tanımı.
 * Aylık/yıllık/taksitli periodlar.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies, persons } from './parties';
import { ownerTypeEnum, payableStatusEnum } from './enums';
import { payableItems } from './finance';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';

export const officialPaymentTypeEnum = pgEnum('official_payment_type', [
  'BAGKUR', // 4-B sigortalı aylık prim
  'SSK',    // 4-A sigortalı aylık prim (işveren)
  'BES',    // bireysel emeklilik
  'ITO',    // İTO aidat
  'KGK',    // KGF garantili kredi
  'GELIR',  // gelir vergisi
  'KDV',    // KDV beyanı
  'MTV',    // motorlu taşıt vergisi
  'OTHER',
]);

export const paymentFrequencyEnum = pgEnum('payment_frequency', [
  'monthly',
  'quarterly',
  'yearly',
  'semiannual',
  'occasional',
]);

export const officialPaymentProfiles = pgTable(
  'official_payment_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    payment_type: officialPaymentTypeEnum('payment_type').notNull(),
    frequency: paymentFrequencyEnum('frequency').notNull().default('monthly'),

    owner_type: ownerTypeEnum('owner_type').notNull(),
    company_id: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    person_id: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    /** Tenant içinde yan şirket / şube (Faz M) — opsiyonel */
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),

    typical_amount: numeric('typical_amount', { precision: 15, scale: 2 }),
    currency: text('currency').notNull().default('TRY'),

    notes: text('notes'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_opp_tenant').on(table.tenant_id),
    typeIdx: index('idx_opp_type').on(table.tenant_id, table.payment_type),
  }),
);

export const officialPaymentPeriods = pgTable(
  'official_payment_periods',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    profile_id: uuid('profile_id')
      .notNull()
      .references(() => officialPaymentProfiles.id, { onDelete: 'cascade' }),

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
    profileIdx: index('idx_opperiod_profile').on(table.profile_id),
    periodIdx: index('idx_opperiod_period').on(table.tenant_id, table.period_label),
  }),
);

export type OfficialPaymentProfile = typeof officialPaymentProfiles.$inferSelect;
export type NewOfficialPaymentProfile = typeof officialPaymentProfiles.$inferInsert;
export type OfficialPaymentPeriod = typeof officialPaymentPeriods.$inferSelect;
