/**
 * job-run-tracker — Cron çalıştırmalarını job_runs tablosuna kaydeden helper.
 *
 * Kullanım:
 *   await trackJobRun('send-reminders', async () => {
 *     // ... iş ...
 *     return { sent: 5, failed: 0 }; // result.json olarak saklanır
 *   });
 *
 * Otomatik:
 *   - started_at + finished_at yazar
 *   - status: 'completed' (normal), 'failed' (throw), 'partial' (return.partial=true)
 *   - hata mesajını error_message'a kaydeder (ilk 2KB)
 *   - duration_ms hesaplar
 *
 * Bu sayede admin /v1/jobs/runs üzerinden cron'ların geçmişine bakabilir,
 * son N saatte 0 başarı varsa alarm konulabilir.
 */
import os from 'node:os';
import { getDb, jobRuns } from '@sayman/db';
import { eq } from 'drizzle-orm';
import { logger } from '../config/logger';

export interface JobRunResult {
  /** Job-spesifik metrikler (sent, failed, vd.) — result jsonb'a yazılır */
  [key: string]: unknown;
  /** True ise status='partial' (kısmi başarı) */
  partial?: boolean;
}

export async function trackJobRun<R extends JobRunResult>(
  jobName: string,
  fn: () => Promise<R>,
): Promise<R> {
  const db = getDb();
  const hostname = os.hostname().slice(0, 64);
  const startedAt = Date.now();

  let runId: string | null = null;
  try {
    const [row] = await db
      .insert(jobRuns)
      .values({ job_name: jobName, status: 'running', hostname })
      .returning({ id: jobRuns.id });
    runId = row?.id ?? null;
  } catch (err) {
    // Tablo henüz yoksa (migration uygulanmadıysa) sessizce devam et — job'u koş
    logger.warn({ err, jobName }, 'job_runs insert failed; job will run untracked');
  }

  try {
    const result = await fn();
    const duration = Date.now() - startedAt;
    if (runId) {
      try {
        await db
          .update(jobRuns)
          .set({
            status: result.partial ? 'partial' : 'completed',
            finished_at: new Date(),
            duration_ms: String(duration),
            result: result as Record<string, unknown>,
          })
          .where(eq(jobRuns.id, runId));
      } catch (err) {
        logger.warn({ err, jobName, runId }, 'job_runs update failed');
      }
    }
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const duration = Date.now() - startedAt;
    if (runId) {
      try {
        await db
          .update(jobRuns)
          .set({
            status: 'failed',
            finished_at: new Date(),
            duration_ms: String(duration),
            error_message: errMsg.slice(0, 2000),
          })
          .where(eq(jobRuns.id, runId));
      } catch (uerr) {
        logger.warn({ uerr, jobName }, 'job_runs failure update failed');
      }
    }
    throw err;
  }
}
