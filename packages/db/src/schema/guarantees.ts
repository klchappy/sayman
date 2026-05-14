/**
 * guarantees — Banka teminat mektupları + komisyon ödemeleri + iade kayıtları.
 * Anayasa Madde 5.11.
 *
 * Aktif teminat mektubu → 3 ayda bir komisyon → süresi dolunca iade.
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
import { banks, companies } from './parties';
import { payableStatusEnum } from './enums';
import { payableItems } from './finance';
import { tenants } from './tenants';

export const guaranteeStatusEnum = pgEnum('guarantee_status', [
  'active',
  'returned',
  'expired',
  'cancelled',
]);

export const guarantees = pgTable(
  'guarantees',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    bank_id: uuid('bank_id').references(() => banks.id, { onDelete: 'set null' }),

    /** Teminat veren şirket (issuer) */
    issuer_company_id: uuid('issuer_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),

    /** Lehdar (beneficiary) — genelde başka bir kurum */
    beneficiary_name: text('beneficiary_name').notNull(),

    letter_no: text('letter_no'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),

    issue_date: date('issue_date'),
    expiry_date: date('expiry_date'),
    returned_at: date('returned_at'),

    /** Komisyon: yıllık oran (%) */
    commission_rate: numeric('commission_rate', { precision: 5, scale: 2 }),
    /** Komisyon ödeme sıklığı (ay) — default 3 */
    commission_frequency_months: integer('commission_frequency_months').notNull().default(3),

    status: guaranteeStatusEnum('status').notNull().default('active'),

    notes: text('notes'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_guarantees_tenant').on(table.tenant_id),
    expiryIdx: index('idx_guarantees_expiry').on(table.expiry_date),
    statusIdx: index('idx_guarantees_status').on(table.tenant_id, table.status),
  }),
);

/**
 * Komisyon ödeme dönemleri (her 3 ayda bir vb.).
 */
export const guaranteeCommissionPeriods = pgTable(
  'guarantee_commission_periods',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    guarantee_id: uuid('guarantee_id')
      .notNull()
      .references(() => guarantees.id, { onDelete: 'cascade' }),

    period_label: text('period_label').notNull(),
    due_date: date('due_date').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    status: payableStatusEnum('status').notNull().default('pending'),

    payable_id: uuid('payable_id').references(() => payableItems.id, { onDelete: 'set null' }),

    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    guaranteeIdx: index('idx_gcperiod_guarantee').on(table.guarantee_id),
    dueIdx: index('idx_gcperiod_due').on(table.due_date),
  }),
);

export type Guarantee = typeof guarantees.$inferSelect;
export type NewGuarantee = typeof guarantees.$inferInsert;
export type GuaranteeCommissionPeriod = typeof guaranteeCommissionPeriods.$inferSelect;
