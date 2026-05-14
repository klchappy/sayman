/**
 * ai_summaries — Günlük AI özet cache (Claude API çıktısı).
 *
 * Cron 07:00 TR: her tenant için "bugünün özeti" üretir, bu tabloya yazar.
 * Dashboard widget cache'den okur (Claude API her dashboard yüklemesinde
 * çağrılmasın).
 */
import { sql } from 'drizzle-orm';
import { date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const aiSummaries = pgTable(
  'ai_summaries',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Hangi tarih için özet (TR günü) */
    summary_date: date('summary_date').notNull(),
    /** Tip: 'daily' | 'weekly' | 'monthly' */
    kind: text('kind').notNull().default('daily'),
    /** Claude'un Türkçe paragrafı */
    summary_text: text('summary_text').notNull(),
    /** Üretimde kullanılan ham veri snapshot (debug için) */
    source_data: jsonb('source_data').default({}).notNull(),
    /** ms */
    duration_ms: text('duration_ms'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tenantDateUq: uniqueIndex('uq_ai_summaries_tenant_date_kind').on(
      table.tenant_id,
      table.summary_date,
      table.kind,
    ),
    tenantIdx: index('idx_ai_summaries_tenant').on(table.tenant_id, table.summary_date),
  }),
);

export type AiSummary = typeof aiSummaries.$inferSelect;
export type NewAiSummary = typeof aiSummaries.$inferInsert;
