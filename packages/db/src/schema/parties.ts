/**
 * parties — şirket/şahıs/mülk master data.
 *
 * Group-shared (organization-scope) — `share_scope` JSON listesi ile hangi
 * tenant'larda görüneceği işaretlenir:
 *   '*'           → tüm tenant'larda görünür
 *   ['tekstil']   → sadece tekstil tenant'ında
 *   ['enerji','tekstil'] → iki tenant'ta görünür (örn. tekstil → enerji fatura)
 *
 * Bu pattern Django seed PROJECT_ANAYASA Madde 6.2 + share_scope[] kararının
 * Damga `org_id` pattern'iyle birleşimi.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ShareScope } from '../types';
import { organizations } from './organizations';

// --- Banka (her zaman group-shared, share_scope yok) -----------------------

export const banks = pgTable(
  'banks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    short_code: text('short_code'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_banks_org').on(table.organization_id),
  }),
);
export type Bank = typeof banks.$inferSelect;
export type NewBank = typeof banks.$inferInsert;

// --- Kurum / Hizmet sağlayıcı (her zaman group-shared) ---------------------

export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    institution_type: text('institution_type'), // TT, CK, IGDAS, BAGKUR, vb.
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_institutions_org').on(table.organization_id),
  }),
);
export type Institution = typeof institutions.$inferSelect;
export type NewInstitution = typeof institutions.$inferInsert;

// --- Şahıs (share_scope ile paylaşılır) ------------------------------------

export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    full_name: text('full_name').notNull(),
    /** TC No — KVKK kapsamında, audit log'da maskelenir */
    national_id: text('national_id'),
    phone: text('phone'),
    family_group: text('family_group'),
    /** Hangi tenant'larda görünür ('*' veya slug listesi) */
    share_scope: jsonb('share_scope')
      .$type<ShareScope>()
      .default(sql`'"*"'::jsonb`)
      .notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_persons_org').on(table.organization_id),
  }),
);
export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;

// --- Şirket (share_scope ile paylaşılır) -----------------------------------

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    short_name: text('short_name'),
    tax_number: text('tax_number'),
    registry_number: text('registry_number'),
    share_scope: jsonb('share_scope')
      .$type<ShareScope>()
      .default(sql`'"*"'::jsonb`)
      .notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_companies_org').on(table.organization_id),
  }),
);
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

// --- Mülk (share_scope ile paylaşılır) -------------------------------------

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    property_type: text('property_type'),
    /** Sahibi: person veya company; iki kolondan biri dolu olur */
    owner_person_id: uuid('owner_person_id').references(() => persons.id, {
      onDelete: 'set null',
    }),
    owner_company_id: uuid('owner_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    municipality: text('municipality'),
    registry_number: text('registry_number'),
    /** SiteX/Pruva34 daire kodu (örn. "A12") */
    site_unit_code: text('site_unit_code'),
    share_scope: jsonb('share_scope')
      .$type<ShareScope>()
      .default(sql`'"*"'::jsonb`)
      .notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_properties_org').on(table.organization_id),
  }),
);
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
