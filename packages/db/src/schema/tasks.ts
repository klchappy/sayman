/**
 * tasks — görev yönetimi. PROJECT_ANAYASA Madde 5.15 + 9.
 *
 * Tenant-scope. Polimorfik bağlantı (related_table + related_id) ile herhangi
 * bir kayıt (fatura, mülk, vb.) bir görev oluşturabilir.
 *
 * Otomatik görev üretimi: GorevSablonu cron'u Faz sonraki.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'normal', 'high', 'urgent']);
export const taskStatusEnum = pgEnum('task_status', [
  'new',
  'in_progress',
  'waiting',
  'postponed',
  'done',
  'cancelled',
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    description: text('description'),
    priority: taskPriorityEnum('priority').notNull().default('normal'),
    status: taskStatusEnum('status').notNull().default('new'),

    /** Polimorfik bağlantı: 'payable_items', 'properties' vb. + id */
    related_table: text('related_table'),
    related_id: uuid('related_id'),

    assigned_to: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    due_date: timestamp('due_date', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    postponed_until: timestamp('postponed_until', { withTimezone: true }),
    postpone_reason: text('postpone_reason'),

    /** GorevSablonu'ndan otomatik üretildiyse */
    auto_generated: boolean('auto_generated').notNull().default(false),
    template_key: text('template_key'),

    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('idx_tasks_tenant').on(table.tenant_id),
    statusIdx: index('idx_tasks_status').on(table.tenant_id, table.status),
    assignedIdx: index('idx_tasks_assigned').on(table.assigned_to),
    dueIdx: index('idx_tasks_due').on(table.due_date),
    relatedIdx: index('idx_tasks_related').on(table.related_table, table.related_id),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
