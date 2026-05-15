import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProd } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../lib/helpers';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'not_found', code: 'NOT_FOUND', path: req.path });
};

/**
 * Tek noktada hata serileştirme:
 *  - ZodError → 400 + issues + code='VALIDATION'
 *  - HttpError → status + message + code
 *  - Diğer (500): production'da generic mesaj, dev'de gerçek mesaj
 *  - Postgres unique violation (23505) → 409 + 'DUPLICATE' (smart-import dışında yakalanmadıysa)
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      code: 'VALIDATION',
      issues: err.issues,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code ?? 'HTTP_ERROR',
    });
    return;
  }

  const pgCode = (err as { code?: string }).code;
  if (pgCode === '23505') {
    res.status(409).json({
      error: 'Kayıt zaten mevcut',
      code: 'DUPLICATE',
    });
    return;
  }
  if (pgCode === '23503') {
    res.status(409).json({
      error: 'İlişkili kayıt bulunamadı',
      code: 'FK_VIOLATION',
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: isProd
      ? 'Sunucu hatası, lütfen daha sonra tekrar deneyin.'
      : (err as Error).message ?? 'internal_error',
    code: 'INTERNAL',
  });
};
