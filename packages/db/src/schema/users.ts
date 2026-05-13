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
import { roleEnum, tenantOverrideValueEnum } from './enums';
import { organizations } from './organizations';
import { tenants } from './tenants';

/**
 * users — Sayman kullanıcıları (sistem geneli).
 *
 * Damga'dan farklı olarak: Sayman bir user'ı birden fazla organization'a
 * bağlayabilir (user_organization_roles üzerinden). Dolayısıyla users.org_id
 * direkt değil — many-to-many.
 *
 * Supabase Auth opsiyonel (auth_user_id). Faz B'de tam entegre olur.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Supabase auth.users.id ile eşleşir (varsa) */
    auth_user_id: uuid('auth_user_id').unique(),
    email: text('email').notNull().unique(),
    username: text('username').unique(),
    full_name: text('full_name').notNull(),
    avatar_url: text('avatar_url'),
    /** Sayman dışı (örn. Damga) entegrasyonlar için */
    phone: text('phone'),
    is_active: boolean('is_active').notNull().default(true),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authIdx: index('idx_users_auth').on(table.auth_user_id),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * user_organization_roles — kullanıcının her organization'daki varsayılan rolü.
 *
 * Bir user N organization'a üye olabilir (örn. mali müşavir 3 holding hizmet veriyor).
 * Bu tablo org-default rol'ü tutar; tenant override için ayrı tablo.
 */
export const userOrganizationRoles = pgTable(
  'user_organization_roles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organization_id: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    role: roleEnum('role').notNull().default('muhasebeci'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_user_org_roles_user').on(table.user_id),
    orgIdx: index('idx_user_org_roles_org').on(table.organization_id),
    uniquePair: uniqueIndex('uniq_user_org_roles').on(table.user_id, table.organization_id),
  }),
);

export type UserOrganizationRole = typeof userOrganizationRoles.$inferSelect;
export type NewUserOrganizationRole = typeof userOrganizationRoles.$inferInsert;

/**
 * user_tenant_overrides — kullanıcının belirli bir tenant'taki rol istisnası.
 *
 * Örnek: Ayşe Kılıç'ta Muhasebeci (default), ama Hukuk tenant'ına girmesin.
 *   user_tenant_overrides(user=Ayşe, tenant=hukuk, value='deny')
 *
 * Örnek 2: Ayşe Enerji'de sadece Görüntüleyici.
 *   user_tenant_overrides(user=Ayşe, tenant=enerji, value='goruntuleyici')
 */
export const userTenantOverrides = pgTable(
  'user_tenant_overrides',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tenant_id: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    value: tenantOverrideValueEnum('value').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_user_tenant_overrides_user').on(table.user_id),
    tenantIdx: index('idx_user_tenant_overrides_tenant').on(table.tenant_id),
    uniquePair: uniqueIndex('uniq_user_tenant_overrides').on(table.user_id, table.tenant_id),
  }),
);

export type UserTenantOverride = typeof userTenantOverrides.$inferSelect;
export type NewUserTenantOverride = typeof userTenantOverrides.$inferInsert;
