/**
 * sso_providers — org bazlı OIDC SSO sağlayıcıları.
 *
 * Her organization kendi Azure AD / Google Workspace / Okta vb. tenant'ına
 * bağlanabilir. Discovery URL'i ile auto-discovery + PKCE + JWKS RS256.
 *
 * client_secret_ciphertext: AES-256-GCM ile şifrelenmiş.
 * client_secret_hint: "abc1...xyz9" (ilk 4 + son 4) display için.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const ssoProviders = pgTable(
  'sso_providers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Org içinde unique short kod: 'azure', 'google', vb. */
    slug: text('slug').notNull(),
    display_name: text('display_name').notNull(),
    provider_kind: text('provider_kind').notNull().default('oidc'),
    issuer_url: text('issuer_url').notNull(),
    client_id: text('client_id').notNull(),
    /** AES-256-GCM ciphertext (secret_box.encryptSecret ile) */
    client_secret_ciphertext: text('client_secret_ciphertext'),
    /** "abc1...xyz9" formatında display hint */
    client_secret_hint: text('client_secret_hint'),
    scopes: text('scopes').notNull().default('openid email profile'),
    /** Sadece bu domain'lerden gelen email'ler kabul edilir; boş = serbest */
    allowed_email_domains: text('allowed_email_domains')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    auto_provision_users: boolean('auto_provision_users').notNull().default(true),
    default_user_role: text('default_user_role').notNull().default('muhasebeci'),
    is_active: boolean('is_active').notNull().default(true),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
    created_by: uuid('created_by'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueOrgSlug: uniqueIndex('uniq_sso_providers_org_slug').on(
      table.organization_id,
      table.slug,
    ),
  }),
);

export type SsoProvider = typeof ssoProviders.$inferSelect;
export type NewSsoProvider = typeof ssoProviders.$inferInsert;
