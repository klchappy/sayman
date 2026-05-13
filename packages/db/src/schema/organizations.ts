import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { OrgSettings } from '../types';
import { planEnum } from './enums';

/**
 * organizations — SaaS müşterisi (holding/firma).
 *
 * Sayman'ı satın alan birim. Bir organization altında N tenant (sektör) yaşar.
 * Damga'daki `orgs` tablosunun karşılığı.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: planEnum('plan').notNull().default('trial'),
  contact_email: text('contact_email'),
  settings: jsonb('settings').$type<OrgSettings>().default({}).notNull(),
  trial_ends_at: timestamp('trial_ends_at', { withTimezone: true }),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
