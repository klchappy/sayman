/**
 * Cron scheduler — API boot'ta tetiklenir.
 *
 * Sayman tek API container'da çalıştığı için node-cron in-process yeterli.
 * Çoklu replica'ya geçilirse → Upstash QStash veya BullMQ migration.
 *
 * Zaman dilimi: Europe/Istanbul (server UTC olsa bile).
 */
import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { trackJobRun } from './job-run-tracker';
import { runBudgetAlerts } from './budget-alerts';
import { runCheckDueAlerts } from './check-due-alerts';
import { runDepreciation } from './run-depreciation';
import { runDeliverWebhooks } from './deliver-webhooks';
import { runDetectAnomalies } from './detect-anomalies';
import { runEmbedPayables } from './embed-payables';
import { runFetchFxRates } from './fetch-fx-rates';
import { runGenerateAiSummary } from './generate-ai-summary';
import { runGeneratePeriods } from './generate-periods';
import { runGenerateTaxCalendar } from './generate-tax-calendar';
import { runSendCollectionReminders } from './send-collection-reminders';
import { runSendReminders } from './send-reminders';
import { runSyncErpConnections } from './sync-erp-connections';
import { runUpdateStatuses } from './update-statuses';

const TZ = 'Europe/Istanbul';

export type JobName =
  | 'generate-periods'
  | 'send-reminders'
  | 'update-statuses'
  | 'fetch-fx-rates'
  | 'deliver-webhooks'
  | 'detect-anomalies'
  | 'generate-ai-summary'
  | 'embed-payables'
  | 'sync-erp-connections'
  | 'generate-tax-calendar'
  | 'budget-alerts'
  | 'check-due-alerts'
  | 'send-collection-reminders'
  | 'run-depreciation';

// Her cron'u job_runs tablosuna kaydediyor — admin /v1/jobs/runs ile geçmişi görür.
async function runJobImpl(name: JobName): Promise<unknown> {
  switch (name) {
    case 'generate-periods':
      return runGeneratePeriods();
    case 'send-reminders':
      return runSendReminders();
    case 'update-statuses':
      return runUpdateStatuses();
    case 'fetch-fx-rates':
      return runFetchFxRates();
    case 'deliver-webhooks':
      return runDeliverWebhooks();
    case 'detect-anomalies':
      return runDetectAnomalies();
    case 'generate-ai-summary':
      return runGenerateAiSummary();
    case 'embed-payables':
      return runEmbedPayables();
    case 'sync-erp-connections':
      return runSyncErpConnections();
    case 'generate-tax-calendar':
      return runGenerateTaxCalendar();
    case 'budget-alerts':
      return runBudgetAlerts();
    case 'check-due-alerts':
      return runCheckDueAlerts();
    case 'send-collection-reminders':
      return runSendCollectionReminders();
    case 'run-depreciation':
      return runDepreciation();
  }
}

export async function runJob(name: JobName): Promise<unknown> {
  logger.info({ job: name }, 'manual job run');
  return trackJobRun(name, async () => {
    const result = await runJobImpl(name);
    // Result obje değilse {} ile sarmalayalım (job_runs.result jsonb)
    return result && typeof result === 'object' ? (result as Record<string, unknown>) : { value: result };
  });
}

let started = false;

export function startCronJobs() {
  if (started) {
    logger.warn('cron jobs already started, skipping');
    return;
  }
  if (env.NODE_ENV === 'test') {
    logger.info('NODE_ENV=test → cron disabled');
    return;
  }

  // Helper: cron schedule + tracked runner. trackJobRun her çalıştırmayı job_runs
  // tablosuna kaydeder, admin /v1/jobs/runs üzerinden geçmişi görebilir.
  const schedule = (jobName: JobName, expr: string) =>
    cron.schedule(
      expr,
      () => {
        runJob(jobName).catch((err) => logger.error({ err, job: jobName }, `${jobName} crashed`));
      },
      { timezone: TZ },
    );

  schedule('generate-periods', '0 3 * * *');        // Daily 03:00 TR
  schedule('send-reminders', '0 9 * * *');          // Daily 09:00 TR
  schedule('update-statuses', '5 * * * *');         // Hourly :05
  schedule('fetch-fx-rates', '0 16 * * *');         // Daily 16:00 TR
  schedule('deliver-webhooks', '* * * * *');        // Every minute
  schedule('detect-anomalies', '0 10 * * *');       // Daily 10:00 TR
  // generate-ai-summary cron'da sendTelegram=true ile çağrılır (manuel runJob default false)
  cron.schedule(
    '0 7 * * *',
    () => {
      trackJobRun('generate-ai-summary', async () => {
        const r = await runGenerateAiSummary({ sendTelegram: true });
        return r as unknown as Record<string, unknown>;
      }).catch((err) => logger.error({ err, job: 'generate-ai-summary' }, 'generate-ai-summary crashed'));
    },
    { timezone: TZ },
  );
  schedule('embed-payables', '30 * * * *');         // Hourly :30
  schedule('sync-erp-connections', '45 * * * *');   // Hourly :45
  schedule('generate-tax-calendar', '0 2 1 * *');   // Her ayın 1'i 02:00 TR
  schedule('budget-alerts', '0 8 * * *');           // Daily 08:00 TR
  schedule('check-due-alerts', '30 9 * * *');       // Daily 09:30 TR
  schedule('send-collection-reminders', '0 10 * * *'); // Daily 10:00 TR

  // Her ayın 1'i 03:30 TR — demirbaş amortisman entry'leri (önceki ay)
  cron.schedule(
    '30 3 1 * *',
    () => {
      runDepreciation().catch((err) => logger.error({ err }, 'run-depreciation crashed'));
    },
    { timezone: TZ },
  );

  started = true;
  logger.info(
    { tz: TZ },
    'cron jobs scheduled (ai-summary@07:00, embed@:30, erp-sync@:45, generate@03:00, reminders@09:00, anomaly@10:00, status@:05, fx@16:00, webhooks@*)',
  );
}
