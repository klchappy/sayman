/**
 * /v1/ai/summary — Cache'li günlük AI özet okuma + manuel tetik.
 *
 *   GET  /v1/ai/summary/today      → bugünün özetini ai_summaries'den çek
 *                                    yoksa anında üret (lazy fallback)
 *   POST /v1/ai/summary/regenerate → mevcut bugünün cache'ini sil + yeniden üret
 *
 * Auth: requireOrg + active tenant.
 */
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { aiSummaries, getDb } from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { todayISO } from '../jobs/helpers';
import { runGenerateAiSummary } from '../jobs/generate-ai-summary';
import { requireAuth } from '../middleware/auth';

export const aiSummaryRouter = Router();

aiSummaryRouter.get('/ai/summary/today', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tenantId = req.saymanContext?.tenantId;
    if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');
    const db = getDb();
    const today = todayISO();

    let [row] = await db
      .select()
      .from(aiSummaries)
      .where(
        and(
          eq(aiSummaries.tenant_id, tenantId),
          eq(aiSummaries.summary_date, today),
          eq(aiSummaries.kind, 'daily'),
        ),
      );

    if (!row) {
      // Lazy generation: cron henüz çalışmamış olabilir (tenant yeni eklendi).
      // Tek tenant için generate çalıştırma maliyetli — runGenerateAiSummary tümünü yapar,
      // sonra tekrar okur.
      await runGenerateAiSummary();
      [row] = await db
        .select()
        .from(aiSummaries)
        .where(
          and(
            eq(aiSummaries.tenant_id, tenantId),
            eq(aiSummaries.summary_date, today),
            eq(aiSummaries.kind, 'daily'),
          ),
        );
    }

    if (!row) {
      res.json({ data: null, message: 'Henüz özet üretilemedi' });
      return;
    }

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

aiSummaryRouter.post(
  '/ai/summary/regenerate',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');
      const db = getDb();
      const today = todayISO();

      await db
        .delete(aiSummaries)
        .where(
          and(
            eq(aiSummaries.tenant_id, tenantId),
            eq(aiSummaries.summary_date, today),
            eq(aiSummaries.kind, 'daily'),
          ),
        );
      const result = await runGenerateAiSummary();
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  },
);
