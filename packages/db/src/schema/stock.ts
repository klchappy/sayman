/**
 * stock_items — ERP'den çekilen stok/ürün bakiyesi.
 *
 * Ürün satan firmalar için kritik: hangi üründen kaç adet kaldı, kritik stok eşiği.
 * Paraşüt /products, Logo ITEMS, Mikro stok kartları'ndan pull edilir.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { erpConnections } from './erp';
import { tenants } from './tenants';

export const stockItems = pgTable(
  'stock_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => erpConnections.id, { onDelete: 'cascade' }),
    external_id: text('external_id').notNull(),
    code: text('code'),
    name: text('name').notNull(),
    unit: text('unit'),
    /** Mevcut stok adet */
    quantity: numeric('quantity', { precision: 18, scale: 3 }).notNull().default('0'),
    /** Birim alış maliyeti */
    purchase_price: numeric('purchase_price', { precision: 18, scale: 2 }),
    /** Birim satış fiyatı */
    sale_price: numeric('sale_price', { precision: 18, scale: 2 }),
    currency: text('currency').notNull().default('TRY'),
    /** Kritik stok eşiği — altında uyarı */
    critical_threshold: numeric('critical_threshold', { precision: 18, scale: 3 }),
    raw_data: jsonb('raw_data').default({}).notNull(),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_stock_tenant').on(table.tenant_id),
    connExtUq: uniqueIndex('uq_stock_external').on(table.connection_id, table.external_id),
    nameIdx: index('idx_stock_name').on(table.name),
  }),
);

export type StockItem = typeof stockItems.$inferSelect;
export type NewStockItem = typeof stockItems.$inferInsert;
