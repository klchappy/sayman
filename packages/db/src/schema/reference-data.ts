/**
 * reference_banks, reference_institutions, reference_government_agencies
 *
 * Sistem-geneli referans veri (Türkiye bankaları + resmi kurumlar + devlet
 * kurumları). Her tenant okuyabilir, sadece super_admin değiştirebilir.
 *
 * NOT: Mevcut `banks` ve `institutions` tabloları org-scope (her şirketin
 * kendi master data'sı). Bu tablolar ise tüm sistem geneli (Türkiye'deki
 * gerçek kurumların temel bilgileri).
 *
 * Kullanım:
 *  - Frontend "Banka seç" dropdown'larında autocomplete kaynağı
 *  - Cari/Çek/Teminat alanında banka bilgisini doğrulamak
 *  - Vergi/SGK borçları için kurum referansı
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Türkiye'deki tüm bankalar (TCMB EFT katılımcı listesinden + katılım bankaları).
 * Sektör: 'commercial' | 'participation' | 'state' | 'development' | 'investment' | 'foreign'
 */
export const referenceBanks = pgTable(
  'reference_banks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** TCMB EFT kodu (5 haneli, örn '00010' Ziraat) — unique */
    eft_code: text('eft_code'),
    /** SWIFT/BIC kodu (8 veya 11 karakter) */
    swift_code: text('swift_code'),
    /** Tam ünvan: "T.C. Ziraat Bankası A.Ş." */
    name: text('name').notNull(),
    /** Kısa ad: "Ziraat" */
    short_name: text('short_name').notNull(),
    /** Sektör */
    sector: text('sector').notNull().default('commercial'),
    /** Devlet bankası mı */
    is_state_bank: boolean('is_state_bank').notNull().default(false),
    /** Katılım bankası mı */
    is_participation: boolean('is_participation').notNull().default(false),
    /** Web sitesi */
    website: text('website'),
    /** Müşteri hizmetleri telefonu */
    customer_service_phone: text('customer_service_phone'),
    /** Logo URL (opsiyonel — CDN'de saklarsak) */
    logo_url: text('logo_url'),
    /** Açıklama (kuruluş yılı, ana faaliyet vs.) */
    description: text('description'),
    /** Aktif mi (TBB'den çıktıysa false yapılır, silmek yerine) */
    is_active: boolean('is_active').notNull().default(true),
    /** Sıralama (genel listede gösterim sırası) */
    sort_order: integer('sort_order').notNull().default(100),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eftCodeUq: uniqueIndex('uq_ref_banks_eft').on(table.eft_code),
    swiftIdx: index('idx_ref_banks_swift').on(table.swift_code),
    sectorIdx: index('idx_ref_banks_sector').on(table.sector),
    nameIdx: index('idx_ref_banks_name').on(table.short_name),
  }),
);

/**
 * Türkiye'deki resmi kurumlar (SGK, GİB, Ticaret Odaları, Noter, vs.).
 * Category: 'tax' | 'social_security' | 'chamber' | 'professional' | 'judicial' | 'notary' | 'municipality' | 'other'
 */
export const referenceInstitutions = pgTable(
  'reference_institutions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Kısa kod (sgk, gib, ito, ...) — unique slug */
    code: text('code').notNull(),
    /** Tam ünvan: "Sosyal Güvenlik Kurumu" */
    name: text('name').notNull(),
    /** Kısa ad: "SGK" */
    short_name: text('short_name').notNull(),
    /** Kategori */
    category: text('category').notNull(),
    /** Bağlı olduğu bakanlık (varsa) */
    parent_ministry: text('parent_ministry'),
    /** Resmi web sitesi */
    website: text('website'),
    /** Çağrı merkezi / telefon */
    phone: text('phone'),
    /** E-posta */
    email: text('email'),
    /** Adres (merkez ofis) */
    address: text('address'),
    /** Açıklama */
    description: text('description'),
    /** Aktif mi */
    is_active: boolean('is_active').notNull().default(true),
    sort_order: integer('sort_order').notNull().default(100),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUq: uniqueIndex('uq_ref_institutions_code').on(table.code),
    categoryIdx: index('idx_ref_institutions_category').on(table.category),
    nameIdx: index('idx_ref_institutions_name').on(table.short_name),
  }),
);

/**
 * Türkiye'deki devlet kurumları (bakanlıklar, müsteşarlıklar, başkanlıklar).
 * Tek tablo (üst seviye). Alt kurumlar (genel müdürlük, daireler) -> reference_institutions.
 */
export const referenceGovernmentAgencies = pgTable(
  'reference_government_agencies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Kısa kod ('hazine_ve_maliye', 'adalet', vs.) */
    code: text('code').notNull(),
    /** Tam ünvan: "T.C. Hazine ve Maliye Bakanlığı" */
    name: text('name').notNull(),
    /** Kısa: "Hazine" */
    short_name: text('short_name').notNull(),
    /** Tip: 'ministry' | 'presidential' | 'authority' | 'undersecretariat' */
    agency_type: text('agency_type').notNull().default('ministry'),
    website: text('website'),
    phone: text('phone'),
    description: text('description'),
    is_active: boolean('is_active').notNull().default(true),
    sort_order: integer('sort_order').notNull().default(100),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUq: uniqueIndex('uq_ref_gov_code').on(table.code),
    typeIdx: index('idx_ref_gov_type').on(table.agency_type),
  }),
);

export type ReferenceBank = typeof referenceBanks.$inferSelect;
export type ReferenceInstitution = typeof referenceInstitutions.$inferSelect;
export type ReferenceGovernmentAgency = typeof referenceGovernmentAgencies.$inferSelect;
