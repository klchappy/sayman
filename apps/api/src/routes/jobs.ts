/**
 * /v1/jobs/run-now/:job — super_admin manual cron tetik.
 *
 * Smoke test ve operasyonel debug için. Production'da 3 cron schedule'la
 * otomatik tetiklenir (Europe/Istanbul TZ).
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, jobRuns, userOrganizationRoles } from '@sayman/db';
import { HttpError } from '../lib/helpers';
import { LIST_LIMITS, listMeta } from '../lib/list-meta';
import { runJob, type JobName } from '../jobs/scheduler';
import { requireAuth } from '../middleware/auth';

const ALLOWED_JOBS: JobName[] = [
  'generate-periods',
  'send-reminders',
  'update-statuses',
  'fetch-fx-rates',
  'deliver-webhooks',
  'detect-anomalies',
  'generate-ai-summary',
  'embed-payables',
  'sync-erp-connections',
  'generate-tax-calendar',
  'budget-alerts',
  'check-due-alerts',
  'send-collection-reminders',
  'run-depreciation',
];

export const jobsRouter = Router();

jobsRouter.post('/jobs/run-now/:job', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser;
    if (!me) throw new HttpError(401, 'auth gerekli', 'NO_AUTH');

    // Platform-wide super_admin kontrol: herhangi bir org'da super_admin rolü var mı?
    const db = getDb();
    const [hasSuperAdmin] = await db
      .select({ id: userOrganizationRoles.id })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.user_id, me.id),
          eq(userOrganizationRoles.role, 'super_admin'),
        ),
      );

    if (!hasSuperAdmin) {
      throw new HttpError(403, 'Cron manuel tetik için super_admin gerekli', 'FORBIDDEN');
    }

    const jobName = String(req.params.job ?? '') as JobName;
    if (!ALLOWED_JOBS.includes(jobName)) {
      throw new HttpError(400, `Bilinmeyen job: ${jobName}. Olası: ${ALLOWED_JOBS.join(', ')}`, 'INVALID_JOB');
    }

    const startedAt = Date.now();
    const result = await runJob(jobName);
    const durationMs = Date.now() - startedAt;

    res.json({
      data: { job: jobName, result, duration_ms: durationMs },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/jobs/runs — cron çalıştırma geçmişi (super_admin only)
 * Query: ?job=send-reminders, ?status=failed, ?since=2026-05-17T00:00:00Z
 */
jobsRouter.get('/jobs/runs', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser;
    if (!me) throw new HttpError(401, 'auth gerekli', 'NO_AUTH');

    const db = getDb();
    const [hasSuperAdmin] = await db
      .select({ id: userOrganizationRoles.id })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.user_id, me.id),
          eq(userOrganizationRoles.role, 'super_admin'),
        ),
      );
    if (!hasSuperAdmin) throw new HttpError(403, 'super_admin gerekli', 'FORBIDDEN');

    const conditions: any[] = [];
    if (req.query.job) conditions.push(eq(jobRuns.job_name, String(req.query.job)));
    if (req.query.status) conditions.push(eq(jobRuns.status, String(req.query.status)));
    if (req.query.since) {
      const since = new Date(String(req.query.since));
      if (!isNaN(since.getTime())) conditions.push(gte(jobRuns.started_at, since));
    }

    const limit = Math.min(Number(req.query.limit ?? LIST_LIMITS.medium), LIST_LIMITS.large);
    const rows = await db
      .select()
      .from(jobRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobRuns.started_at))
      .limit(limit);

    res.json({ data: rows, ...listMeta(rows, rows.length, limit) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/jobs/runs/summary — her cron için son durum + son 24h istatistik
 */
jobsRouter.get('/jobs/runs/summary', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser;
    if (!me) throw new HttpError(401, 'auth gerekli', 'NO_AUTH');

    const db = getDb();
    const [hasSuperAdmin] = await db
      .select({ id: userOrganizationRoles.id })
      .from(userOrganizationRoles)
      .where(
        and(
          eq(userOrganizationRoles.user_id, me.id),
          eq(userOrganizationRoles.role, 'super_admin'),
        ),
      );
    if (!hasSuperAdmin) throw new HttpError(403, 'super_admin gerekli', 'FORBIDDEN');

    const result = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (job_name) job_name, status, started_at, finished_at, error_message, duration_ms
        FROM job_runs
        ORDER BY job_name, started_at DESC
      ),
      stats AS (
        SELECT job_name,
          COUNT(*) FILTER (WHERE status = 'failed' AND started_at > NOW() - INTERVAL '24 hours')::int AS fail_24h,
          COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours')::int AS runs_24h
        FROM job_runs
        GROUP BY job_name
      )
      SELECT l.job_name, l.status AS last_status, l.started_at AS last_started_at,
             l.finished_at AS last_finished_at, l.duration_ms AS last_duration_ms,
             l.error_message AS last_error,
             COALESCE(s.fail_24h, 0) AS fail_24h,
             COALESCE(s.runs_24h, 0) AS runs_24h
      FROM latest l
      LEFT JOIN stats s ON s.job_name = l.job_name
      ORDER BY l.job_name
    `);

    res.json({ data: (result as any).rows ?? result });
  } catch (err) {
    next(err);
  }
});
