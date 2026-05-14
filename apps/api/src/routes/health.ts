import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '@sayman/db';
import { isConfigured } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let db = 'unknown';
  try {
    const conn = getDb();
    await conn.execute(sql`select 1`);
    db = 'ok';
  } catch {
    db = 'error';
  }

  res.json({
    status: 'ok',
    db,
    ts: new Date().toISOString(),
    integrations: isConfigured,
    cron: {
      tz: 'Europe/Istanbul',
      schedule: {
        'generate-periods': '0 3 * * *',
        'generate-ai-summary': '0 7 * * *',
        'send-reminders': '0 9 * * *',
        'detect-anomalies': '0 10 * * *',
        'fetch-fx-rates': '0 16 * * *',
        'update-statuses': '5 * * * *',
        'embed-payables': '30 * * * *',
        'deliver-webhooks': '* * * * *',
      },
    },
  });
});

/**
 * /v1/health/healthz — Coolify healthcheck için ultra-light endpoint.
 * DB'ye bakmaz; sadece process ayakta mı bilgisi.
 */
healthRouter.get('/health/healthz', (_req, res) => {
  res.type('text/plain').send('ok\n');
});
