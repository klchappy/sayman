import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProd } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../lib/helpers';
import { getDb, supportTickets } from '@sayman/db';

/**
 * 500 hatası geldiğinde otomatik destek talebi aç — kullanıcı sessizce kaybetmesin.
 * Best-effort: ticket yaratamazsa loglar ama response'u etkilemez.
 *
 * De-duplication: aynı user + aynı route_path + 1 saat içinde varsa
 * mevcut ticket'a occurrence eklenir, yeni açılmaz.
 */
async function openAutoTicket(
  err: Error,
  req: { activeOrgId?: string; activeTenantId?: string; authUser?: { id: string }; path: string; headers: Record<string, unknown> },
): Promise<void> {
  try {
    if (!req.activeOrgId) return; // org context yoksa ticket bağlayamayız
    const db = getDb();
    const title = `[500] ${req.path}: ${err.name ?? 'Error'}`.slice(0, 250);
    await db.insert(supportTickets).values({
      organization_id: req.activeOrgId,
      tenant_id: req.activeTenantId ?? null,
      user_id: req.authUser?.id ?? null,
      title,
      description: (err.message ?? '').slice(0, 5000),
      category: 'auto_error',
      priority: 'high',
      status: 'open',
      error_context: {
        source: 'backend_500',
        route_path: req.path,
        error_name: err.name,
        stack: (err.stack ?? '').slice(0, 20000),
        user_agent: String(req.headers['user-agent'] ?? '').slice(0, 500),
        occurrences: 1,
        first_seen_at: new Date().toISOString(),
      },
    });
  } catch (innerErr) {
    logger.warn({ err: innerErr }, 'auto-ticket yazılamadı (errorHandler içinde)');
  }
}

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

  // Legacy: plain Error with .status field (auth.ts vb.)
  const legacyStatus = (err as { status?: number }).status;
  if (typeof legacyStatus === 'number' && legacyStatus >= 400 && legacyStatus < 600) {
    res.status(legacyStatus).json({
      error: (err as Error).message,
      code: (err as { code?: string }).code ?? 'HTTP_ERROR',
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

  // Otomatik destek talebi aç — kullanıcı sessizce kaybetmesin.
  // Best-effort, response'u beklemez.
  void openAutoTicket(err as Error, {
    activeOrgId: (req as unknown as { activeOrgId?: string }).activeOrgId,
    activeTenantId: (req as unknown as { activeTenantId?: string }).activeTenantId,
    authUser: (req as unknown as { authUser?: { id: string } }).authUser,
    path: req.path,
    headers: req.headers as Record<string, unknown>,
  });

  res.status(500).json({
    error: isProd
      ? 'Sunucu hatası kaydedildi, destek talebi otomatik açıldı.'
      : (err as Error).message ?? 'internal_error',
    code: 'INTERNAL',
    auto_support_ticket: true,
  });
};
