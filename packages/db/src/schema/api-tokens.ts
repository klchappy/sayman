/**
 * api_tokens — Programmatic erişim için kişisel API token'lar.
 *
 * Akış:
 *   1. Kullanıcı /security'den "API Token Üret" → name + opsiyonel scopes
 *   2. Plain token sadece bir kez gösterilir ("st_" + 32 byte base64url)
 *   3. DB'de sha256(token) saklanır
 *   4. Middleware Authorization: Bearer st_... → token_hash lookup → req.authUser
 *   5. last_used_at update; expires_at varsa kontrol; revoked_at varsa reddedilir
 *
 * Scope'lar (opsiyonel): "read", "write", veya boş → full user yetkisi.
 * Şimdilik basit, ileride permission matrisi entegre edilir.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authAccounts } from './auth';

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    account_id: uuid('account_id')
      .notNull()
      .references(() => authAccounts.id, { onDelete: 'cascade' }),

    /** Kullanıcı tarafından verilen ad (örn: "Damga entegrasyonu", "n8n webhook") */
    name: text('name').notNull(),
    /** SHA-256(pepper + plain_token) — plaintext yalnız create response'unda döner */
    token_hash: text('token_hash').notNull().unique(),
    /** Token'ın ilk 8 karakteri (st_ABCD1234) — UI'da gösterim için */
    token_prefix: text('token_prefix').notNull(),

    /** Opsiyonel scope listesi — boşsa user'ın tüm yetkileri */
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),

    expires_at: timestamp('expires_at', { withTimezone: true }),
    last_used_at: timestamp('last_used_at', { withTimezone: true }),
    last_used_ip: text('last_used_ip'),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('idx_api_tokens_account').on(table.account_id),
    hashIdx: index('idx_api_tokens_hash').on(table.token_hash),
  }),
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
