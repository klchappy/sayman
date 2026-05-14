/**
 * user_permission_overrides — gelecekteki RBAC matrix için.
 *
 * Sayman'ın mevcut user_organization_roles + user_tenant_overrides yapısı
 * org+tenant seviye rol verir. Bu tablo daha granüler scope-bazlı izinler için:
 *   scope='finance.export'  override='allow'   → bu user ihracatı yapabilir
 *   scope='kvkk.forget'     override='deny'    → blocklenir
 *
 * Faz B/C/D'de henüz aktif olarak kullanılmıyor; gelecek hazırlık.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Örn. 'finance.export', 'kvkk.forget', 'sso.manage' */
    scope: text('scope').notNull(),
    /** 'allow' | 'deny' | 'inherit' */
    override: text('override').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_user_perm_overrides_user').on(table.user_id),
    scopeIdx: index('idx_user_perm_overrides_scope').on(table.organization_id, table.scope),
  }),
);

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type NewUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;
