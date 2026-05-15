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
import { organizations } from './organizations';
import { tenants } from './tenants';
import { users } from './users';

/**
 * integration_credentials — 3rd-party servis credential'ları.
 *
 * Lookup chain (getIntegrationCredentials helper):
 *   1) tenant_id = X → tenant override
 *   2) tenant_id IS NULL + org_id = X → org default
 *   3) env fallback (geriye uyumluluk)
 *
 * `credentials` JSONB her servis için kendi şemasını taşır:
 *   claude    → { api_key }
 *   voyage    → { api_key }
 *   resend    → { api_key, email_from }
 *   telegram  → { bot_token }
 *   whatsapp  → { access_token, phone_number_id, verify_token }
 */
export const integrationCredentials = pgTable(
  'integration_credentials',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    /** NULL → org-level default (tüm tenant'lar kullanır) */
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    integration_key: text('integration_key').notNull(),
    credentials: jsonb('credentials').default({}).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lookupIdx: index('idx_int_cred_lookup').on(
      table.organization_id,
      table.tenant_id,
      table.integration_key,
    ),
    uniqOrgDefault: uniqueIndex('uniq_int_cred_org_default').on(
      table.organization_id,
      table.integration_key,
    ),
  }),
);

export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type NewIntegrationCredential = typeof integrationCredentials.$inferInsert;
