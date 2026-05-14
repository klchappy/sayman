/**
 * /v1/jobs/run-now/:job — super_admin manual cron tetik.
 *
 * Smoke test ve operasyonel debug için. Production'da 3 cron schedule'la
 * otomatik tetiklenir (Europe/Istanbul TZ).
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, userOrganizationRoles } from '@sayman/db';
import { HttpError } from '../lib/helpers';
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
