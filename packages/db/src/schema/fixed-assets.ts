/**
 * fixed_assets — Demirbaş ve sabit kıymet kaydı.
 *
 * Türkiye muhasebe pratiğine uyumlu: kayıtlı maliyet, faydalı ömür, amortisman
 * yöntemi, hurda değeri. Cron her ay 1'inde aylık amortisman entry'si yaratır.
 *
 * Amortisman yöntemleri:
 *   - linear: aylık taksit = (cost - salvage) / (life_months)
 *   - declining_balance: her ay önceki değerin %X'i (basit yaklaşım)
 *
 * Status akışı: active → sold | disposed | written_off
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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { subsidiaries } from './subsidiaries';
import { tenants } from './tenants';
import { users } from './users';

export const fixedAssets = pgTable(
  'fixed_assets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subsidiary_id: uuid('subsidiary_id').references(() => subsidiaries.id, {
      onDelete: 'set null',
    }),
    /** Demirbaş kodu — örn "DMR-2026-001" */
    code: text('code'),
    name: text('name').notNull(),
    /** 'vehicle' | 'equipment' | 'building' | 'furniture' | 'electronics' | 'other' */
    category: text('category').notNull().default('other'),
    purchase_date: date('purchase_date').notNull(),
    purchase_cost: numeric('purchase_cost', { precision: 18, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('TRY'),
    /** Faydalı ömür ay olarak (Maliye Bakanlığı'nın yıl listesi × 12) */
    useful_life_months: numeric('useful_life_months', { precision: 5 }).notNull(),
    /** 'linear' | 'declining_balance' (azalan bakiyeler) */
    depreciation_method: text('depreciation_method').notNull().default('linear'),
    /** Azalan bakiyeler için yıllık oran % (default 20 = 5 yıllık) */
    declining_rate_pct: numeric('declining_rate_pct', { precision: 5, scale: 2 }),
    /** Hurda değer — amortismanın sınırı */
    salvage_value: numeric('salvage_value', { precision: 18, scale: 2 }).default('0').notNull(),
    /** Birikmiş amortisman — her ay arttırılır */
    accumulated_depreciation: numeric('accumulated_depreciation', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    /** 'active' | 'sold' | 'disposed' | 'written_off' */
    status: text('status').notNull().default('active'),
    /** Çıkış tarihi (sold/disposed/written_off durumunda) */
    disposed_at: date('disposed_at'),
    /** Satıldıysa satış tutarı */
    disposal_proceeds: numeric('disposal_proceeds', { precision: 18, scale: 2 }),
    location: text('location'),
    serial_no: text('serial_no'),
    supplier_name: text('supplier_name'),
    /** İlgili alış faturası (varsa) */
    related_payable_id: uuid('related_payable_id'),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_fixed_assets_tenant').on(table.tenant_id, table.status),
    categoryIdx: index('idx_fixed_assets_category').on(table.category),
  }),
);

export const depreciationEntries = pgTable(
  'depreciation_entries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    asset_id: uuid('asset_id')
      .notNull()
      .references(() => fixedAssets.id, { onDelete: 'cascade' }),
    /** YYYY-MM */
    period: text('period').notNull(),
    /** Bu ayın amortisman tutarı */
    depreciation_amount: numeric('depreciation_amount', { precision: 18, scale: 2 }).notNull(),
    /** Bu ay sonu birikmiş amortisman (toplam) */
    accumulated_depreciation: numeric('accumulated_depreciation', { precision: 18, scale: 2 }).notNull(),
    /** Net defter değeri (cost - accumulated) */
    book_value_after: numeric('book_value_after', { precision: 18, scale: 2 }).notNull(),
    /** Manuel kilit — dönem kapatıldıktan sonra değişmesin */
    is_locked: boolean('is_locked').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assetIdx: index('idx_depreciation_asset').on(table.asset_id, table.period),
    assetPeriodUq: uniqueIndex('uq_depreciation_asset_period').on(table.asset_id, table.period),
  }),
);

export type FixedAsset = typeof fixedAssets.$inferSelect;
export type NewFixedAsset = typeof fixedAssets.$inferInsert;
export type DepreciationEntry = typeof depreciationEntries.$inferSelect;
export type NewDepreciationEntry = typeof depreciationEntries.$inferInsert;
