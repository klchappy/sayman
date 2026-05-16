/**
 * support_tickets — destek talepleri + otomatik hata raporları.
 *
 * Kategori:
 *   'auto_error' — ErrorBoundary veya 500 error middleware otomatik açar
 *   'bug'        — kullanıcı raporu
 *   'feature_request'
 *   'question'
 *
 * Status: open → in_progress → resolved → closed
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { tenants } from './tenants';
import { users } from './users';

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull().default('question'),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('open'),

    /** Otomatik hata raporu metadata: url, stack, user_agent, http_status, ... */
    error_context: jsonb('error_context'),
    /** Sadece admin görür */
    internal_notes: text('internal_notes'),

    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    resolved_by: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('idx_support_tickets_org').on(
      table.organization_id,
      table.status,
      table.created_at,
    ),
    userIdx: index('idx_support_tickets_user').on(table.user_id, table.created_at),
    statusIdx: index('idx_support_tickets_status').on(
      table.status,
      table.priority,
      table.created_at,
    ),
  }),
);

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
