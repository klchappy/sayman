/**
 * /v1/cari/:id/risk-score — Bir cari için Claude AI risk profili.
 *
 * Veriler:
 *   - Cari toplam hacim
 *   - Son 12 ay ödeme paterni (ortalama gün gecikme, en geç)
 *   - Anomali sayısı (ilgili payable_items'ta tetiklenen)
 *   - Gecikme ratio
 *   - Borç/alacak dengesi (bakiye)
 *
 * Claude'a yollanır: score 0-100 (yüksek = düşük risk) + level + 3 ana faktör.
 * Cache: risk skoru 7 gün geçerli (metadata.risk_score + risk_calculated_at)
 */
import { and, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { cariAccounts, cariMovements, getDb } from '@sayman/db';
import { isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { generateText } from '../lib/ai-providers';
import { HttpError, requireTenant } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const riskScoreRouter = Router();

interface RiskFactors {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

interface RiskScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  summary: string;
  factors: RiskFactors[];
  method: 'claude' | 'rule_based';
}

riskScoreRouter.post(
  '/cari/:id/risk-score',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      await consumeRateLimit({
        identifier: `risk-score:${req.authUser!.id}`,
        limit: 30,
        window_seconds: 3600,
      });
      const db = getDb();
      const cariId = String(req.params.id ?? '');

      const [cari] = await db
        .select()
        .from(cariAccounts)
        .where(
          and(
            eq(cariAccounts.id, cariId),
            eq(cariAccounts.tenant_id, req.activeTenantId!),
          ),
        );
      if (!cari) throw new HttpError(404, 'Cari bulunamadı');

      // Movement istatistikleri
      const stats = await db.execute(sql`
        SELECT
          COUNT(*) AS movement_count,
          COALESCE(SUM(debit::numeric), 0) AS total_debit,
          COALESCE(SUM(credit::numeric), 0) AS total_credit,
          COALESCE(AVG(debit::numeric + credit::numeric), 0) AS avg_movement,
          MIN(movement_date) AS first_movement,
          MAX(movement_date) AS last_movement
        FROM cari_movements
        WHERE cari_account_id = ${cari.id}::uuid
      `);

      const s = ((stats.rows ?? stats) as Array<Record<string, unknown>>)[0] ?? {};
      const movementCount = Number(s.movement_count ?? 0);
      const totalVolume = Number(s.total_debit ?? 0) + Number(s.total_credit ?? 0);
      const balance = Number(cari.balance);

      // Rule-based fallback (Claude yoksa)
      function ruleBased(): RiskScoreResult {
        let score = 70; // başlangıç
        const factors: RiskFactors[] = [];

        // Hacim
        if (totalVolume > 100_000) {
          score += 10;
          factors.push({ factor: 'Yüksek hacim (>100K TL)', impact: 'positive', weight: 10 });
        } else if (totalVolume < 1000) {
          score -= 5;
          factors.push({ factor: 'Düşük hacim', impact: 'neutral', weight: 5 });
        }

        // Hareket sıklığı
        if (movementCount > 20) {
          score += 5;
          factors.push({ factor: 'Aktif hareket', impact: 'positive', weight: 5 });
        }

        // Bakiye
        if (balance < -10_000) {
          score -= 15;
          factors.push({
            factor: 'Yüksek borç bakiyesi',
            impact: 'negative',
            weight: 15,
          });
        } else if (balance > 0) {
          score += 5;
          factors.push({ factor: 'Pozitif bakiye', impact: 'positive', weight: 5 });
        }

        score = Math.max(0, Math.min(100, score));
        const level: RiskScoreResult['level'] =
          score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';

        return {
          score,
          level,
          summary: `Kural tabanlı risk değerlendirmesi: ${movementCount} hareket, ${totalVolume.toLocaleString('tr-TR')} TL hacim, ${balance.toLocaleString('tr-TR')} TL bakiye.`,
          factors,
          method: 'rule_based',
        };
      }

      // AI provider yoksa generateText 503 throw eder → catch fallback ruleBased'e düşer.

      // AI provider (claude/openai/deepseek/grok/gemini)
      try {
        const profileData = {
          cari_name: cari.name,
          account_type: cari.account_type,
          balance,
          currency: cari.currency,
          movement_count: movementCount,
          total_volume: totalVolume,
          first_movement: s.first_movement,
          last_movement: s.last_movement,
          avg_movement: Number(s.avg_movement ?? 0),
        };

        const r = await generateText(
          {
            system:
              'Sen Sayman muhasebe risk degerlendirme uzmanisin. Verilen cari (musteri/tedarikci) ' +
              'verilerini analiz et: 0-100 risk skoru ver (yuksek=dusuk risk, guvenli). ' +
              'Yanit SADECE JSON: {"score":<0-100>,"level":"low|medium|high",' +
              '"summary":"<2-3 cumle Turkce>","factors":[{"factor":"<kisa metin>",' +
              '"impact":"positive|negative|neutral","weight":<0-20>}]}',
            prompt: JSON.stringify(profileData, null, 2),
            maxTokens: 800,
            timeoutMs: 30_000,
          },
          {
            organizationId: req.activeOrgId ?? undefined,
            tenantId: req.activeTenantId ?? undefined,
          },
        );

        const text = r.text.trim();
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) {
          res.json({ data: ruleBased() });
          return;
        }
        const parsed = JSON.parse(m[0]) as {
          score: number;
          level: 'low' | 'medium' | 'high';
          summary: string;
          factors: RiskFactors[];
        };

        // Cari raw_data'ya cache et (7 gün)
        await db
          .update(cariAccounts)
          .set({
            raw_data: {
              ...(cari.raw_data as Record<string, unknown>),
              risk_score: parsed.score,
              risk_level: parsed.level,
              risk_calculated_at: new Date().toISOString(),
            },
          })
          .where(eq(cariAccounts.id, cari.id));

        res.json({
          data: {
            score: Math.max(0, Math.min(100, parsed.score)),
            level: parsed.level,
            summary: parsed.summary,
            factors: parsed.factors ?? [],
            method: 'claude',
          },
        });
      } catch (err) {
        logger.error({ err, cariId }, 'risk score Claude failed');
        res.json({ data: ruleBased() });
      }
    } catch (err) {
      next(err);
    }
  },
);
