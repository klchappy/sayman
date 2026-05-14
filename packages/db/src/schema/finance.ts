/**
 * finance — fatura/ödeme tenant-scoped tablolar.
 *
 * Bu tablolar TENANT seviyesinde izole (tenant_id zorunlu). API middleware
 * her sorguda tenant_id filtresi koyar (RLS opsiyonel, app-layer enforcement).
 *
 * Django seed `apps.finance.models` PayableItem + PaymentTransaction'ın
 * Drizzle karşılığı.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { companies, institutions, persons } from './parties';
import {
  ownerTypeEnum,
  payableStatusEnum,
  paymentMethodEnum,
  transactionStatusEnum,
} from './enums';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';
import { users } from './users';

/**
 * payable_items — takip edilen fatura/borç/ödeme kalemi.
 */
export const payableItems = pgTable(
  'payable_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),

    // Sahip
    owner_type: ownerTypeEnum('owner_type').notNull().default('company'),
    company_id: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
    person_id: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    /** Tenant içinde yan şirket / şube (Faz M) — opsiyonel */
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),

    // Tanım
    title: text('title').notNull(),
    category: text('category'),
    institution_id: uuid('institution_id').references(() => institutions.id, {
      onDelete: 'set null',
    }),
    supplier_name: text('supplier_name'),
    invoice_number: text('invoice_number'),
    subscription_reference: text('subscription_reference'),
    /** Dönem (örn. "2026-05") */
    period_label: text('period_label'),

    // Tarihler
    issue_date: date('issue_date'),
    due_date: date('due_date'),
    /** Otomatik talimat tarihi */
    auto_payment_date: date('auto_payment_date'),

    // Tutarlar
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    paid_amount: numeric('paid_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('TRY'),

    // Durum
    status: payableStatusEnum('status').notNull().default('pending'),
    expected_method: paymentMethodEnum('expected_method'),

    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),

    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_payable_tenant').on(table.tenant_id),
    statusIdx: index('idx_payable_status').on(table.status),
    dueIdx: index('idx_payable_due').on(table.due_date),
    periodIdx: index('idx_payable_period').on(table.tenant_id, table.period_label),
  }),
);
export type PayableItem = typeof payableItems.$inferSelect;
export type NewPayableItem = typeof payableItems.$inferInsert;

/**
 * payment_transactions — bir payable_item için yapılan ödeme.
 *
 * Bir kalem birden fazla ödeme alabilir (kısmi ödeme, mutabakat).
 */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    payable_id: uuid('payable_id')
      .references(() => payableItems.id, { onDelete: 'cascade' })
      .notNull(),

    paid_at: date('paid_at').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    method: paymentMethodEnum('method').notNull(),

    /** Banka FK opsiyonel (banks tablosu var; FK eklenebilir ileride) */
    bank_short_code: text('bank_short_code'),
    receipt_url: text('receipt_url'),
    reference_no: text('reference_no'),

    status: transactionStatusEnum('status').notNull().default('approved'),
    notes: text('notes'),

    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approved_by: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approved_at: timestamp('approved_at', { withTimezone: true }),

    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_payment_tenant').on(table.tenant_id),
    payableIdx: index('idx_payment_payable').on(table.payable_id),
  }),
);
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
