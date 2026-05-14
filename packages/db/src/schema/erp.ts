/**
 * ERP entegrasyonu — ana muhasebe yazılımlarıyla iki yönlü senkron.
 *
 * Sayman bir "operasyon platformu"dur — muhasebe yazılımı (Logo, Mikro, Paraşüt,
 * Nebim, vs.) firmanın asıl kayıt sistemidir. Buradan cari ekstresi, fatura,
 * stok bakiyesi, ödeme hareketi gibi verileri çekip Sayman'a yansıtırız.
 *
 * Tablolar:
 *   erp_connections    — her org için 1+ bağlantı (provider, config encrypted)
 *   erp_sync_logs      — her sync çalışmasının kaydı (debug + audit)
 *   cari_accounts      — pull edilen cari hesaplar (müşteri/tedarikçi)
 *   cari_movements     — cari ekstre satırları (borç/alacak)
 *
 * Providerlar:
 *   parasut — Paraşüt Cloud API (REST + OAuth2)
 *   logo    — Logo Tiger / Netsis (REST API + Logo Cloud)
 *   mikro   — Mikro Yazılım (REST)
 *   nebim   — Nebim N3/V3 (REST)
 *   manual  — Manuel CSV import (API'si olmayanlar için)
 */
import { sql } from 'drizzle-orm';
import {
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
import { organizations } from './organizations';
import { tenants } from './tenants';

export const erpConnections = pgTable(
  'erp_connections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Null = org-level (tüm tenant'lar paylaşır), uuid = sadece bu tenant'a yazar */
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    /** 'parasut' | 'logo' | 'mikro' | 'nebim' | 'manual' */
    provider: text('provider').notNull(),
    /** Kullanıcı dostu ad — örn "ABC Şirket Logo Tiger" */
    name: text('name').notNull(),
    /** Şifrelenmiş JSON: API URL, key, OAuth tokens, company_id, vs. (secret-box ile) */
    config_encrypted: text('config_encrypted').notNull(),
    /** Public config (UI'ye gösterilebilir, secret değil) */
    public_config: jsonb('public_config').default({}).notNull(),
    /** 'active' | 'paused' | 'error' */
    status: text('status').notNull().default('active'),
    /** Cron sync periyodu — saat (default 1, 0 = sadece manuel) */
    sync_interval_hours: numeric('sync_interval_hours', { precision: 4, scale: 1 })
      .default('1')
      .notNull(),
    last_sync_at: timestamp('last_sync_at', { withTimezone: true }),
    last_sync_status: text('last_sync_status'),
    last_sync_error: text('last_sync_error'),
    sync_count: numeric('sync_count', { precision: 10 }).default('0').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_erp_connections_org').on(table.organization_id, table.status),
    tenantIdx: index('idx_erp_connections_tenant').on(table.tenant_id),
  }),
);

export const erpSyncLogs = pgTable(
  'erp_sync_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => erpConnections.id, { onDelete: 'cascade' }),
    /** 'cari' | 'cari_movement' | 'invoice' | 'stock' | 'full' */
    entity_type: text('entity_type').notNull(),
    /** 'manual' | 'cron' */
    trigger: text('trigger').notNull().default('manual'),
    /** 'running' | 'success' | 'partial' | 'error' */
    status: text('status').notNull().default('running'),
    records_pulled: numeric('records_pulled', { precision: 10 }).default('0').notNull(),
    records_pushed: numeric('records_pushed', { precision: 10 }).default('0').notNull(),
    records_failed: numeric('records_failed', { precision: 10 }).default('0').notNull(),
    duration_ms: numeric('duration_ms', { precision: 10 }),
    error_message: text('error_message'),
    details: jsonb('details').default({}).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    connectionIdx: index('idx_erp_sync_logs_connection').on(
      table.connection_id,
      table.started_at,
    ),
  }),
);

export const cariAccounts = pgTable(
  'cari_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => erpConnections.id, { onDelete: 'cascade' }),
    /** ERP'deki orijinal ID — provider'da unique */
    external_id: text('external_id').notNull(),
    /** Cari kodu — örn "120.01.001" */
    code: text('code'),
    /** Cari adı — örn "ABC Şirket Ltd. Şti." */
    name: text('name').notNull(),
    /** 'customer' | 'supplier' | 'both' */
    account_type: text('account_type').notNull().default('both'),
    tax_id: text('tax_id'),
    tax_office: text('tax_office'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    /** Güncel bakiye — pozitif = alacak (cari bize borçlu), negatif = borç */
    balance: numeric('balance', { precision: 18, scale: 2 }).default('0').notNull(),
    currency: text('currency').default('TRY').notNull(),
    raw_data: jsonb('raw_data').default({}).notNull(),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_cari_accounts_tenant').on(table.tenant_id, table.account_type),
    connectionExtUq: uniqueIndex('uq_cari_accounts_external').on(
      table.connection_id,
      table.external_id,
    ),
    nameIdx: index('idx_cari_accounts_name').on(table.name),
  }),
);

export const cariMovements = pgTable(
  'cari_movements',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => erpConnections.id, { onDelete: 'cascade' }),
    cari_account_id: uuid('cari_account_id')
      .notNull()
      .references(() => cariAccounts.id, { onDelete: 'cascade' }),
    /** ERP'deki movement ID — bu satır unique */
    external_id: text('external_id').notNull(),
    /** Hareket tarihi */
    movement_date: date('movement_date').notNull(),
    /** Açıklama — örn "PEŞİN SATIŞ FT 2026-01234" */
    description: text('description'),
    /** Belge No — fiş, fatura, çek vb. */
    document_no: text('document_no'),
    /** 'invoice' | 'payment' | 'check' | 'note' | 'opening_balance' | 'other' */
    document_type: text('document_type'),
    /** Borç hareketi (cari bize borç) */
    debit: numeric('debit', { precision: 18, scale: 2 }).default('0').notNull(),
    /** Alacak hareketi (cari bizden alacak) */
    credit: numeric('credit', { precision: 18, scale: 2 }).default('0').notNull(),
    /** Bu hareketten sonra hesabın bakiyesi (ERP yansıması) */
    balance_after: numeric('balance_after', { precision: 18, scale: 2 }),
    currency: text('currency').default('TRY').notNull(),
    raw_data: jsonb('raw_data').default({}).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    cariIdx: index('idx_cari_movements_account').on(
      table.cari_account_id,
      table.movement_date,
    ),
    connectionExtUq: uniqueIndex('uq_cari_movements_external').on(
      table.connection_id,
      table.external_id,
    ),
    tenantDateIdx: index('idx_cari_movements_tenant_date').on(
      table.tenant_id,
      table.movement_date,
    ),
  }),
);

export type ErpConnection = typeof erpConnections.$inferSelect;
export type NewErpConnection = typeof erpConnections.$inferInsert;
export type ErpSyncLog = typeof erpSyncLogs.$inferSelect;
export type NewErpSyncLog = typeof erpSyncLogs.$inferInsert;
export type CariAccount = typeof cariAccounts.$inferSelect;
export type NewCariAccount = typeof cariAccounts.$inferInsert;
export type CariMovement = typeof cariMovements.$inferSelect;
export type NewCariMovement = typeof cariMovements.$inferInsert;
