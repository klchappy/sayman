/**
 * sales_invoices — Sayman'in ALACAK (gelir) tarafi.
 *
 * payable_items "ödemekle yükümlü olduğumuz" faturalar içindir (gider tarafı).
 * sales_invoices ise "kestiğimiz, alacaklı olduğumuz" faturalar (gelir tarafı).
 *
 * Bir muhasebe operasyon platformu için her iki taraf da olmalı:
 *   - "Toplam alacak ne kadar"
 *   - "Hangi müşteriden gecikme var"
 *   - "Bu ay ne kadar tahsil ettim"
 *
 * ERP ile çift yönlü: Paraşüt /sales_invoices, Logo SalesInvoice tip 4.
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
import { companies, persons } from './parties';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';
import { users } from './users';

export const salesInvoices = pgTable(
  'sales_invoices',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),

    /** Müşteri: kişi ya da şirket */
    customer_type: text('customer_type').notNull().default('company'),
    customer_company_id: uuid('customer_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    customer_person_id: uuid('customer_person_id').references(() => persons.id, {
      onDelete: 'set null',
    }),
    /** Free-text müşteri adı — master data'ya bağlı değilse */
    customer_name: text('customer_name'),

    title: text('title').notNull(),
    invoice_number: text('invoice_number'),
    issue_date: date('issue_date'),
    due_date: date('due_date'),

    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    paid_amount: numeric('paid_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: text('currency').notNull().default('TRY'),

    /** 'draft' | 'sent' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled' */
    status: text('status').notNull().default('sent'),

    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),

    /** ERP push mapping (paragüt sales_invoices, logo sales invoice) */
    erp_connection_id: uuid('erp_connection_id'),
    erp_external_id: text('erp_external_id'),
    erp_push_status: text('erp_push_status'),
    erp_pushed_at: timestamp('erp_pushed_at', { withTimezone: true }),
    erp_push_error: text('erp_push_error'),

    /** Auto-import review flow */
    needs_review: boolean('needs_review').notNull().default(false),
    auto_created_source: text('auto_created_source'),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    reviewed_by: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),

    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_sales_tenant').on(table.tenant_id, table.status),
    dueIdx: index('idx_sales_due').on(table.due_date),
    customerIdx: index('idx_sales_customer').on(table.customer_company_id),
    erpIdx: index('idx_sales_erp').on(table.erp_connection_id, table.erp_push_status),
    reviewIdx: index('idx_sales_invoice_review').on(table.tenant_id, table.needs_review),
  }),
);

export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type NewSalesInvoice = typeof salesInvoices.$inferInsert;
