/**
 * /v1/ai/explain/payable/:id — Claude API ile fatura "anormal mi?" açıklaması.
 *
 * Endpoint payable + supplier geçmişi + son N benzer faturayı topluyor,
 * Claude'a "bu kayıt niye dikkat çekici?" diye soruyor. Anomaly cron'unun
 * "öyle deniyor" çıktısını gerçekten okunabilir hale getirir.
 *
 * Rate-limit: 20/saat/user — pahalı sorgu.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, payableItems } from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { HttpError, requireOrg } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const aiExplainRouter = Router();

aiExplainRouter.get(
  '/ai/explain/payable/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!isConfigured.ai) {
        throw new HttpError(503, 'AI yapılandırılmamış', 'NO_AI');
      }
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

      consumeRateLimit({
        identifier: `ai-explain:${req.authUser!.id}`,
        limit: 20,
        window_seconds: 3600,
      });

      const db = getDb();
      const [p] = await db
        .select()
        .from(payableItems)
        .where(
          and(eq(payableItems.id, String(req.params.id ?? '')), eq(payableItems.tenant_id, tenantId)),
        );
      if (!p) throw new HttpError(404, 'Fatura bulunamadı');

      // Aynı tedarikçinin son 6 ay geçmişi (varsa)
      let history: Array<Record<string, unknown>> = [];
      if (p.supplier_name) {
        history = await db
          .select({
            title: payableItems.title,
            amount: payableItems.amount,
            due_date: payableItems.due_date,
            status: payableItems.status,
            created_at: payableItems.created_at,
          })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.is_active, true),
              eq(payableItems.supplier_name, p.supplier_name),
              sql`${payableItems.id} != ${p.id}`,
              sql`${payableItems.created_at} > NOW() - INTERVAL '6 months'`,
            ),
          )
          .orderBy(desc(payableItems.created_at))
          .limit(10);
      }

      // İstatistik: ortalama, sapma
      const amounts = history.map((h) => Number(h.amount)).filter((n) => !isNaN(n));
      const mean = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      const current = Number(p.amount);
      const ratio = mean > 0 ? current / mean : 0;

      const promptData = {
        payable: {
          title: p.title,
          amount: current,
          supplier: p.supplier_name,
          invoice_number: p.invoice_number,
          due_date: p.due_date,
          status: p.status,
          category: p.category,
          notes: p.notes,
        },
        supplier_history_last_6mo: history,
        stats: {
          history_count: history.length,
          mean_amount: Math.round(mean * 100) / 100,
          current_vs_mean_ratio: Math.round(ratio * 100) / 100,
        },
      };

      let answer = '';
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system:
              'Sen Sayman muhasebe asistanisin. Verilen fatura JSONu ve tedarikci 6 ay gecmisini incele. ' +
              'Bu kayit NEDEN dikkat cekici veya OLAGAN? Kisaca (3-4 cumle, Turkce, eylem odakli) acikla. ' +
              'Eger her sey normalse bunu sakince soyle. Sayilari TL formatla. Olcek: ' +
              '1) tutarin gecmise gore farki, 2) vade riski, 3) tedarikci pattern, 4) tavsiyen.',
            messages: [
              {
                role: 'user',
                content: JSON.stringify(promptData, null, 2),
              },
            ],
          }),
        });
        if (!resp.ok) {
          const errTxt = await resp.text();
          throw new Error(`Claude API: ${resp.status} ${errTxt.slice(0, 100)}`);
        }
        const data = (await resp.json()) as { content: Array<{ type: string; text?: string }> };
        answer = data.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n')
          .trim();
      } catch (err) {
        logger.warn({ err, payableId: p.id }, 'ai-explain Claude call failed');
        // Graceful fallback — rule-based açıklama
        if (ratio > 2 && history.length >= 3) {
          answer = `Bu fatura ${current.toLocaleString('tr-TR')} TL ile, "${p.supplier_name}" için son 6 ay ortalaması ${mean.toLocaleString('tr-TR')} TL olan tutarın ${ratio.toFixed(1)}× üstünde. Olağandışı yüksek. Faturayı tekrar doğrulamak iyi olabilir.`;
        } else if (history.length === 0 && p.supplier_name) {
          answer = `"${p.supplier_name}" için bu tenant'ta ilk fatura. Karşılaştırma yapılacak geçmiş yok. İlk faturalarda kontrol değerli.`;
        } else {
          answer = `Tutar (${current.toLocaleString('tr-TR')} TL) tedarikçi geçmişiyle uyumlu görünüyor (ortalama ${mean.toLocaleString('tr-TR')} TL). Vade: ${p.due_date ?? '-'}.`;
        }
      }

      res.json({
        data: {
          payable_id: p.id,
          answer,
          stats: promptData.stats,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
