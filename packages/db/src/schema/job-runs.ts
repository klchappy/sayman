/**
 * job_runs — Cron job çalıştırmalarının persistent log'u.
 *
 * Önceden cron job hataları sadece logger.error/warn ile uçucu loglara
 * yazılıyordu — admin server log'una bakmadan job'un sustuğunu/fail ettiğini
 * göremiyordu. Bu tablo:
 *   - Her cron çalıştırmasını kalıcı kaydeder (started_at, finished_at, status)
 *   - result_json içinde job-spesifik metrikleri tutar (sent_count, error_count vd.)
 *   - error_message ile last failure'ı saklar
 *   - Admin /v1/jobs/runs üzerinden geriye dönük inceleyebilir
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Cron tanımındaki ad: generate-periods / send-reminders / detect-anomalies / ... */
    job_name: text('job_name').notNull(),

    /** running / completed / failed / partial */
    status: text('status').notNull().default('running'),

    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finished_at: timestamp('finished_at', { withTimezone: true }),
    duration_ms: text('duration_ms'),

    /** Job-spesifik metrikler — örn { sent: 5, failed: 2, skipped: 1 } */
    result: jsonb('result').default(sql`'{}'::jsonb`).notNull(),

    /** Fail durumunda son hata mesajı (stack'in ilk 2KB'ı) */
    error_message: text('error_message'),

    /** Hangi server instance koştu (debug için) */
    hostname: text('hostname'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobNameIdx: index('idx_job_runs_name').on(table.job_name),
    startedIdx: index('idx_job_runs_started').on(table.started_at),
    statusIdx: index('idx_job_runs_status').on(table.status),
  }),
);

export type JobRun = typeof jobRuns.$inferSelect;
export type NewJobRun = typeof jobRuns.$inferInsert;
