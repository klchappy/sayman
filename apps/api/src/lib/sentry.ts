/**
 * Sentry init — graceful (env yoksa no-op).
 *
 * apps/api/src/index.ts → import './lib/sentry' (boot'ta init)
 * Tüm unhandled error'lar otomatik Sentry'e gider; pino logger ile paralel.
 */
import * as Sentry from '@sentry/node';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';

export function initSentry() {
  if (!isConfigured.sentry) {
    logger.debug('Sentry not configured — skipping init');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN!,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });

  logger.info({ env: env.NODE_ENV }, 'Sentry initialized');
}

export { Sentry };
