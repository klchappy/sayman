/**
 * payment_approvals — Yüksek tutarlı ödemelerde çift onay akışı.
 *
 * Akış:
 *   1. Kullanıcı ödeme önerir → payment_approvals (status=pending)
 *   2. Org admin onaylar → status=approved → asıl payment_transactions kaydı oluşur
 *   3. Veya org admin reddeder → status=rejected
 *
 * Eşik tutar org_settings'te tutulabilir; MVP'de 50000 TRY hardcoded.
 * is_active false → soft delete.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { payableItems } from './finance';
import { tenants } from './tenants';
import { users } from './users';

export const paymentApprovals = pgTable(
  'payment_approvals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    payable_id: uuid('payable_id')
      .notNull()
      .references(() => payableItems.id, { onDelete: 'cascade' }),
    requested_by_user_id: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    approver_user_id: uuid('approver_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),
    method: text('method').notNull(),
    reference_no: text('reference_no'),
    paid_at: text('paid_at').notNull(),
    note: text('note'),
    /** 'pending' | 'approved' | 'rejected' | 'cancelled' */
    status: text('status').notNull().default('pending'),
    /** Onaylama/red sebep */
    decision_reason: text('decision_reason'),
    decided_at: timestamp('decided_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_payment_approvals_tenant').on(table.tenant_id, table.status),
    payableIdx: index('idx_payment_approvals_payable').on(table.payable_id),
  }),
);

export type PaymentApproval = typeof paymentApprovals.$inferSelect;
export type NewPaymentApproval = typeof paymentApprovals.$inferInsert;
