import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TenantSettings } from '../types';
import { sectorEnum } from './enums';
import { organizations } from './organizations';

/**
 * tenants — bir Organization altındaki tek bir sektör (tekstil/enerji/...).
 *
 * Tenant-scoped tablolar (payable_items, payment_transactions, vs.) tüm sorgularda
 * `tenant_id` ile filtrelenir (Damga `org_id` pattern'inin Sayman'a uyarlanmış hâli).
 *
 * Subdomain: `{slug}.{org.slug}.sayman.deploi.net`
 *   örn: tekstil.kilic.sayman.deploi.net
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    sector: sectorEnum('sector').notNull().default('diger'),
    /** Tenant'ın VKN/TCKN'si — e-Fatura recipient match için */
    tax_number: text('tax_number'),
    /** Açık modüller (boş → SECTOR_DEFAULT_MODULES) */
    active_modules: text('active_modules').array().notNull().default(sql`'{}'::text[]`),
    settings: jsonb('settings').$type<TenantSettings>().default({}).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_tenants_org').on(table.organization_id),
    sectorIdx: index('idx_tenants_sector').on(table.sector),
    /** Aynı organization altında aynı slug tekrar olmasın */
    uniqueSlug: uniqueIndex('uniq_tenants_org_slug').on(table.organization_id, table.slug),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
