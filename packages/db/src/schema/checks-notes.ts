/**
 * checks_and_notes — Çek ve senet (bono) takibi.
 *
 * Türkiye'de hala yaygın ödeme aracı. Bir çek:
 *   - drawer: keşideci (çeki yazan, ödeyecek olan)
 *   - beneficiary: lehtar (parayı alacak olan)
 *   - bank: ödemenin yapılacağı banka
 *   - amount, due_date
 *
 * Senet (bono) için de aynı yapı; tip farklı.
 *
 * Yön (direction):
 *   - 'incoming': bizim aldığımız çek/senet (alacak)
 *   - 'outgoing': bizim yazdığımız çek/senet (borç)
 *
 * Status akışı:
 *   incoming: 'portfolio' → 'deposited' → 'cashed' (veya 'returned' / 'cancelled')
 *   outgoing: 'issued' → 'cashed' (veya 'cancelled')
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
import { banks } from './parties';
import { payableItems } from './finance';
import { salesInvoices } from './sales';
import { tenants } from './tenants';
import { users } from './users';

export const checksAndNotes = pgTable(
  'checks_and_notes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'check' | 'promissory_note' (bono) */
    kind: text('kind').notNull().default('check'),
    /** 'incoming' (alacak) | 'outgoing' (borç) */
    direction: text('direction').notNull(),
    /** Çek/Senet seri no */
    document_no: text('document_no'),
    /** Keşideci adı (free text, master data'ya bağlı değil) */
    drawer_name: text('drawer_name'),
    /** Lehtar adı */
    beneficiary_name: text('beneficiary_name'),
    /** Bağlı banka (opsiyonel — incoming çekler için ödeyen bankayı yazar) */
    bank_id: uuid('bank_id').references(() => banks.id, { onDelete: 'set null' }),
    bank_branch: text('bank_branch'),
    bank_account_no: text('bank_account_no'),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),
    issue_date: date('issue_date'),
    due_date: date('due_date').notNull(),
    /** Status:
     *  incoming: portfolio | deposited | cashed | returned | cancelled
     *  outgoing: issued | cashed | bounced | cancelled
     */
    status: text('status').notNull().default('portfolio'),
    /** Portföyde tuttuğumuz çekler için iç numara (örn "PF-2026-001") */
    portfolio_no: text('portfolio_no'),
    /** İlgili fatura — alış faturasına karşılık verdiğimiz çek (outgoing) */
    related_payable_id: uuid('related_payable_id').references(() => payableItems.id, {
      onDelete: 'set null',
    }),
    /** İlgili satış faturası — müşteriden aldığımız çek (incoming) */
    related_sales_invoice_id: uuid('related_sales_invoice_id').references(() => salesInvoices.id, {
      onDelete: 'set null',
    }),
    /** Banka'ya teslim tarihi (deposited durumuna geçince) */
    deposited_at: date('deposited_at'),
    /** Tahsil edildi tarihi */
    cashed_at: date('cashed_at'),
    /** Karşılıksız döndü/iade tarihi */
    returned_at: date('returned_at'),
    return_reason: text('return_reason'),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_checks_tenant').on(table.tenant_id, table.direction, table.status),
    dueIdx: index('idx_checks_due').on(table.tenant_id, table.due_date),
    relatedPayableIdx: index('idx_checks_payable').on(table.related_payable_id),
    relatedSalesIdx: index('idx_checks_sales').on(table.related_sales_invoice_id),
  }),
);

export type CheckOrNote = typeof checksAndNotes.$inferSelect;
export type NewCheckOrNote = typeof checksAndNotes.$inferInsert;
