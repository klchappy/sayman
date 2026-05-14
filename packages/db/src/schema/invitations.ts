/**
 * invitations — bir org'a kullanıcı davet etmek için token-tabanlı flow.
 *
 * Akış:
 *   1. organization_admin POST /users/invite { email, role, tenant_id? }
 *   2. invitations satırı oluşur (token + expires_at)
 *   3. Davet linki: https://sayman.deploi.net/auth/accept-invite?token=...
 *   4. Davet alan kişi şifre belirler → POST /users/accept-invite
 *      → auth_account + user + role + (opsiyonel tenant_override)
 *
 * Idempotent: aynı email + org için pending davet varsa yenilenir, yeni
 * satır oluşmaz.
 */
import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { authAccounts } from './auth';
import { organizations } from './organizations';
import { tenants } from './tenants';

export const userInvitations = pgTable(
  'user_invitations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** Atanacak organization-level rol (shared.ROLES enum'undan) */
    role: text('role').notNull(),
    /** Belirli bir tenant'a scope'lu davet — null ise org-level (tüm tenant'lar) */
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    /** Davet eden auth_account_id */
    invited_by: uuid('invited_by').references(() => authAccounts.id, {
      onDelete: 'set null',
    }),

    /** SHA-256(secret_pepper + token_random) — plaintext yalnız e-postada gönderilir */
    token_hash: text('token_hash').notNull(),
    /** 24 saat default */
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    accepted_at: timestamp('accepted_at', { withTimezone: true }),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),

    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Pending invite: org+email başına maksimum 1 aktif davet
    pendingUq: uniqueIndex('uq_user_invitations_org_email_pending')
      .on(table.organization_id, table.email)
      .where(sql`accepted_at IS NULL AND revoked_at IS NULL`),
    tokenIdx: index('idx_user_invitations_token').on(table.token_hash),
    orgIdx: index('idx_user_invitations_org').on(table.organization_id),
  }),
);

export type UserInvitation = typeof userInvitations.$inferSelect;
export type NewUserInvitation = typeof userInvitations.$inferInsert;
