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
import { runBudgetAlerts } from './budget-alerts';
import { runDeliverWebhooks } from './deliver-webhooks';
import { runDetectAnomalies } from './detect-anomalies';
import { runEmbedPayables } from './embed-payables';
import { runFetchFxRates } from './fetch-fx-rates';
import { runGenerateAiSummary } from './generate-ai-summary';
import { runGeneratePeriods } from './generate-periods';
import { runGenerateTaxCalendar } from './generate-tax-calendar';
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
  | 'budget-alerts';

export async function runJob(name: JobName): Promise<unknown> {
  logger.info({ job: name }, 'manual job run');
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
  }
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

  // Daily 03:00 TR — period auto-generation
  cron.schedule(
    '0 3 * * *',
    () => {
      runGeneratePeriods().catch((err) => logger.error({ err }, 'generate-periods crashed'));
    },
    { timezone: TZ },
  );

  // Daily 09:00 TR — reminders (mail)
  cron.schedule(
    '0 9 * * *',
    () => {
      runSendReminders().catch((err) => logger.error({ err }, 'send-reminders crashed'));
    },
    { timezone: TZ },
  );

  // Hourly :05 — status sweep
  cron.schedule(
    '5 * * * *',
    () => {
      runUpdateStatuses().catch((err) => logger.error({ err }, 'update-statuses crashed'));
    },
    { timezone: TZ },
  );

  // Weekday 16:00 TR — TCMB FX rate fetch (Cumartesi/Pazar XML yok ama job graceful)
  cron.schedule(
    '0 16 * * *',
    () => {
      runFetchFxRates().catch((err) => logger.error({ err }, 'fetch-fx-rates crashed'));
    },
    { timezone: TZ },
  );

  // Every minute — webhook delivery worker (kuyruktan POST + retry)
  cron.schedule(
    '* * * * *',
    () => {
      runDeliverWebhooks().catch((err) => logger.error({ err }, 'deliver-webhooks crashed'));
    },
    { timezone: TZ },
  );

  // Daily 10:00 TR — anomali tespiti
  cron.schedule(
    '0 10 * * *',
    () => {
      runDetectAnomalies().catch((err) => logger.error({ err }, 'detect-anomalies crashed'));
    },
    { timezone: TZ },
  );

  // Daily 07:00 TR — günlük AI özet üret (dashboard widget + Telegram'a yolla)
  cron.schedule(
    '0 7 * * *',
    () => {
      runGenerateAiSummary({ sendTelegram: true }).catch((err) =>
        logger.error({ err }, 'generate-ai-summary crashed'),
      );
    },
    { timezone: TZ },
  );

  // Hourly :30 — semantic search için bekleyen payable'lara embedding üret
  cron.schedule(
    '30 * * * *',
    () => {
      runEmbedPayables().catch((err) => logger.error({ err }, 'embed-payables crashed'));
    },
    { timezone: TZ },
  );

  // Hourly :45 — ERP bağlantılarını sync et (sync_interval_hours dolanlar)
  cron.schedule(
    '45 * * * *',
    () => {
      runSyncErpConnections().catch((err) =>
        logger.error({ err }, 'sync-erp-connections crashed'),
      );
    },
    { timezone: TZ },
  );

  // Her ayın 1'i 02:00 TR — Türk vergi takvimi gelecek 90 günün event'leri
  cron.schedule(
    '0 2 1 * *',
    () => {
      runGenerateTaxCalendar().catch((err) =>
        logger.error({ err }, 'generate-tax-calendar crashed'),
      );
    },
    { timezone: TZ },
  );

  // Her gün 08:00 TR — bütçe aşılma kontrolü
  cron.schedule(
    '0 8 * * *',
    () => {
      runBudgetAlerts().catch((err) => logger.error({ err }, 'budget-alerts crashed'));
    },
    { timezone: TZ },
  );

  started = true;
  logger.info(
    { tz: TZ },
    'cron jobs scheduled (ai-summary@07:00, embed@:30, erp-sync@:45, generate@03:00, reminders@09:00, anomaly@10:00, status@:05, fx@16:00, webhooks@*)',
  );
}
