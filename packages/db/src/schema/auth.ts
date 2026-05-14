/**
 * auth schema — SANTRAL blueprint hibrit refactor.
 *
 * Supabase Auth yerine kendi auth kaynağı: bcrypt password_hash + TOTP +
 * server-side jti iptal edilebilir sessions.
 *
 * NOT: Mevcut `users.auth_user_id` (Supabase auth.users.id ile bağlı) eski
 * davranış olarak korunur; geçiş sonrası `users.auth_account_id` (auth_accounts
 * tablosuna FK) kullanılır.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * auth_accounts — kimlik kaynağı.
 * Email global unique (organization-bağımsız).
 */
export const authAccounts = pgTable('auth_accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  full_name: text('full_name'),
  /** bcrypt hash, cost 12 (production) / 10 (dev) */
  password_hash: text('password_hash').notNull(),
  /** RFC 6238 TOTP secret (base32). AES-GCM şifrelenmiş saklanır (decrypt helper'ı kullan) */
  totp_secret: text('totp_secret'),
  totp_enabled: boolean('totp_enabled').notNull().default(false),
  totp_enabled_at: timestamp('totp_enabled_at', { withTimezone: true }),
  /** SHA-256(JWT_SECRET pepper + recovery_code) — plain saklama */
  totp_recovery_codes: text('totp_recovery_codes')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;

/**
 * auth_sessions — server-side JWT iptal için.
 * Her sign-in bir jti üretir; logout / revoke ile revoked_at set edilir.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    account_id: uuid('account_id')
      .notNull()
      .references(() => authAccounts.id, { onDelete: 'cascade' }),
    /** JWT'nin jti claim'iyle eşleşir */
    jti: text('jti').notNull().unique(),
    issued_at: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
    ip_address: text('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jtiActiveIdx: index('idx_auth_sessions_jti_active').on(table.jti),
    accountIdx: index('idx_auth_sessions_account').on(table.account_id, table.revoked_at),
  }),
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

/**
 * password_reset_tokens — süreli (2 saat) + tek kullanımlık.
 * Plain token caller'a döner; DB'de sadece SHA-256 hash saklanır.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    account_id: uuid('account_id')
      .notNull()
      .references(() => authAccounts.id, { onDelete: 'cascade' }),
    /** SHA-256(plain_token) — plain saklama */
    token_hash: text('token_hash').notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumed_at: timestamp('consumed_at', { withTimezone: true }),
    ip_address: text('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('uniq_password_reset_token_hash').on(table.token_hash),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * platform_admins — Sayman platformunu yöneten global süper-adminler.
 * Belirli org'a bağlı değil, tüm Sayman kurulumuna erişim sağlar.
 */
export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type NewPlatformAdmin = typeof platformAdmins.$inferInsert;
