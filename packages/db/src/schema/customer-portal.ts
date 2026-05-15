/**
 * customer_portal_tokens — Müşteri portali için public erişim tokenleri.
 *
 * Bir cari (müşteri) için token üretirsin: müşteri token'lı URL'ye girer,
 * kendi cari ekstresini ve faturalarını görür (read-only, auth-less).
 *
 * URL şablonu: https://sayman.deploi.net/portal/{token}
 *
 * Güvenlik:
 *   - token 48 char random base64url (entropy bol)
 *   - expires_at zorunlu (max 1 yıl)
 *   - is_active false yapılınca anında devre dışı
 *   - revoked_at audit için
 *   - last_accessed_at + access_count → kullanım izleme
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { cariAccounts } from './erp';
import { tenants } from './tenants';
import { users } from './users';

export const customerPortalTokens = pgTable(
  'customer_portal_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    cari_account_id: uuid('cari_account_id')
      .notNull()
      .references(() => cariAccounts.id, { onDelete: 'cascade' }),
    /** Public token (44+ char) */
    token: text('token').notNull(),
    /** Müşteri tarafına gösterilecek isim (label) */
    label: text('label'),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
    access_count: numeric('access_count', { precision: 10 }).notNull().default('0'),
    last_accessed_at: timestamp('last_accessed_at', { withTimezone: true }),
    last_accessed_ip: text('last_accessed_ip'),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cariIdx: index('idx_customer_portal_cari').on(table.cari_account_id),
    tokenUq: uniqueIndex('uq_customer_portal_token').on(table.token),
  }),
);

export type CustomerPortalToken = typeof customerPortalTokens.$inferSelect;
export type NewCustomerPortalToken = typeof customerPortalTokens.$inferInsert;
