/**
 * audit_log — sistem geneli denetim kayıtları.
 *
 * Anayasa Madde 3.5: her kritik işlem AuditLog'a yazılır.
 * Madde 12.1: TC No / hassas veriler `before_data` / `after_data` JSON'unda maskelenir.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { auditActionEnum } from './enums';
import { organizations } from './organizations';
import { tenants } from './tenants';
import { users } from './users';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    /** Tenant-scope'lu işlem ise tenant_id dolu olur */
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    actor_id: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

    action: auditActionEnum('action').notNull(),
    /** Hangi modülden geldiği (örn. "finance.payable_items") */
    module: text('module').notNull(),
    /** Etkilenen kayıt tablosu + id */
    target_table: text('target_table'),
    target_id: uuid('target_id'),

    before_data: jsonb('before_data'),
    after_data: jsonb('after_data'),

    ip_address: text('ip_address'),
    user_agent: text('user_agent'),
    notes: text('notes'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_audit_org').on(table.organization_id),
    tenantIdx: index('idx_audit_tenant').on(table.tenant_id),
    actorIdx: index('idx_audit_actor').on(table.actor_id),
    actionIdx: index('idx_audit_action').on(table.action),
    createdIdx: index('idx_audit_created').on(table.created_at),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
