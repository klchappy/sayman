/**
 * attachments — polimorfik dosya ekleri (payable_items, guarantees, vb.).
 *
 * Supabase Storage'da `sayman-attachments` bucket'ında saklanan dosyaların
 * meta kayıtları. file_path bucket içindeki yol; UI signed URL ile indirir.
 *
 * Polimorfik: related_table + related_id ile herhangi bir tabloya bağlanabilir.
 *   - payable_items
 *   - guarantees
 *   - subscriptions
 *   - regular_payment_profiles
 *   - official_payment_profiles
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    /** Hangi tabloya bağlı (polimorfik) */
    related_table: text('related_table').notNull(),
    related_id: uuid('related_id').notNull(),

    /** Supabase Storage path: "tenant_id/resource_id/uuid.ext" */
    file_path: text('file_path').notNull(),
    file_name: text('file_name').notNull(),
    mime_type: text('mime_type').notNull(),
    /** byte cinsinden — PostgreSQL bigint */
    size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),

    description: text('description'),

    uploaded_by: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    relatedIdx: index('idx_attachments_related').on(table.related_table, table.related_id),
    tenantIdx: index('idx_attachments_tenant').on(table.tenant_id),
  }),
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
