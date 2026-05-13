import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', issues: err.issues });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({
    error: (err as Error).message ?? 'internal_error',
  });
};
