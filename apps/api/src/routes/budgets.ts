/**
 * /v1/budgets — Kategori bazlı aylık/quarterly/yıllık bütçe planlama.
 *
 *   GET    /v1/budgets?period=2026-05      → o dönemin bütçeleri + gerçekleşen
 *   POST   /v1/budgets                     → yeni bütçe
 *   PATCH  /v1/budgets/:id                 → planned_amount, threshold güncelle
 *   DELETE /v1/budgets/:id                 → soft delete
 *   GET    /v1/budgets/comparison          → tüm aktif dönem karşılaştırma
 *
 * Gerçekleşen tutar: payable_items.amount toplamı, period ve kategoriye göre.
 * "Bu ay elektrik 5000 planladı, 4200 harcadı, %84 kullanım" gibi.
 */
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { budgets, getDb, payableItems } from '@sayman/db';
import { CATEGORY_LABELS, PAYABLE_CATEGORIES, type PayableCategory } from '@sayman/shared';
import { isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { auditFromRequest } from '../lib/audit';
import { generateText } from '../lib/ai-providers';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
import { requireAuth } from '../middleware/auth';

export const budgetsRouter = Router();

/** Period → tarih aralığı (created_at filter için) */
function periodToRange(period: string, kind: string): { from: string; to: string } | null {
  if (kind === 'monthly') {
    // 2026-05
    const m = period.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const from = `${y}-${String(mm).padStart(2, '0')}-01`;
    const last = new Date(y, mm, 0).getDate();
    const to = `${y}-${String(mm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
  }
  if (kind === 'quarterly') {
    // 2026-Q2
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    const y = Number(m[1]);
    const q = Number(m[2]);
    const mStart = (q - 1) * 3 + 1;
    const mEnd = q * 3;
    const lastDay = new Date(y, mEnd, 0).getDate();
    return {
      from: `${y}-${String(mStart).padStart(2, '0')}-01`,
      to: `${y}-${String(mEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (kind === 'yearly') {
    const y = Number(period);
    if (isNaN(y)) return null;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return null;
}

async function computeActual(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  category: string,
  from: string,
  to: string,
): Promise<number> {
  const [r] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric), 0)`,
    })
    .from(payableItems)
    .where(
      and(
        eq(payableItems.tenant_id, tenantId),
        eq(payableItems.is_active, true),
        eq(payableItems.category, category),
        gte(payableItems.issue_date, from),
        lte(payableItems.issue_date, to),
      ),
    );
  return Number(r?.total ?? 0);
}

budgetsRouter.get('/budgets', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const period = req.query.period ? String(req.query.period) : null;
    const db = getDb();
    const conditions: any[] = [
      tenantScope(req, budgets.tenant_id),
      eq(budgets.is_active, true),
    ];
    if (period) conditions.push(eq(budgets.period, period));

    const rows = await db
      .select()
      .from(budgets)
      .where(and(...conditions))
      .orderBy(desc(budgets.period), budgets.category);

    // N+1 fix — aynı tarih aralığını paylaşan bütçeler için tek GROUP BY sorgusu.
    // 10 bütçenin hepsi 2026-05 aralığındaysa 10 sorgu yerine 1 sorgu.
    const tenantId = req.activeTenantId!;
    const actuals = new Map<string, number>(); // budgetId → actual

    // Range bazlı gruplama
    type RangeBucket = { from: string; to: string; budgets: Array<{ id: string; category: string }> };
    const buckets = new Map<string, RangeBucket>();
    for (const b of rows) {
      const range = periodToRange(b.period, b.period_kind);
      if (!range) {
        actuals.set(b.id, 0);
        continue;
      }
      const key = `${range.from}|${range.to}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { from: range.from, to: range.to, budgets: [] };
        buckets.set(key, bucket);
      }
      bucket.budgets.push({ id: b.id, category: b.category });
    }

    await Promise.all(
      Array.from(buckets.values()).map(async (bucket) => {
        const categories = [...new Set(bucket.budgets.map((b) => b.category))];
        const totals = await db
          .select({
            category: payableItems.category,
            total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric), 0)`,
          })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.is_active, true),
              inArray(payableItems.category, categories),
              gte(payableItems.issue_date, bucket.from),
              lte(payableItems.issue_date, bucket.to),
            ),
          )
          .groupBy(payableItems.category);
        const byCategory = new Map(totals.map((t) => [t.category, Number(t.total)]));
        for (const b of bucket.budgets) actuals.set(b.id, byCategory.get(b.category) ?? 0);
      }),
    );

    const enriched = rows.map((b) => {
      const actual = actuals.get(b.id) ?? 0;
      const planned = Number(b.planned_amount);
      const usagePct = planned > 0 ? (actual / planned) * 100 : 0;
      return {
        ...b,
        actual_amount: actual,
        usage_pct: Math.round(usagePct * 10) / 10,
        over_budget: actual > planned,
        category_label: CATEGORY_LABELS[b.category as PayableCategory] ?? b.category,
      };
    });

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  category: z.string().min(2).max(64),
  period_kind: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  period: z.string().min(2).max(20),
  planned_amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  alert_threshold_pct: z.number().min(0).max(200).default(80).optional(),
  notes: z.string().max(500).optional().nullable(),
});

budgetsRouter.post('/budgets', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    try {
      const [row] = await db
        .insert(budgets)
        .values({
          tenant_id: req.activeTenantId!,
          category: body.category,
          period_kind: body.period_kind,
          period: body.period,
          planned_amount: body.planned_amount,
          currency: body.currency,
          alert_threshold_pct: String(body.alert_threshold_pct ?? 80),
          notes: body.notes ?? null,
          created_by: req.authUser?.id ?? null,
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'budget.create',
        target_type: 'budgets',
        target_id: row?.id ?? null,
        details: {
          category: body.category,
          period: body.period,
          period_kind: body.period_kind,
          planned_amount: body.planned_amount,
          currency: body.currency,
        },
      });

      res.status(201).json({ data: row });
    } catch (err) {
      if ((err as Error).message.includes('uq_budgets')) {
        throw new HttpError(409, 'Bu kategori + dönem için zaten bütçe var');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  planned_amount: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  alert_threshold_pct: z.number().min(0).max(200).optional(),
  notes: z.string().optional().nullable(),
});

budgetsRouter.patch('/budgets/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const db = getDb();
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.planned_amount != null) patch.planned_amount = body.planned_amount;
    if (body.alert_threshold_pct != null)
      patch.alert_threshold_pct = String(body.alert_threshold_pct);
    if (body.notes !== undefined) patch.notes = body.notes;

    const [row] = await db
      .update(budgets)
      .set(patch)
      .where(
        and(
          eq(budgets.id, String(req.params.id ?? '')),
          eq(budgets.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Bütçe bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'budget.update',
      target_type: 'budgets',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: {
        changed: Object.keys(patch).filter((k) => k !== 'updated_at'),
        patch,
      },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.delete('/budgets/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(budgets)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(budgets.id, String(req.params.id ?? '')),
          eq(budgets.tenant_id, req.activeTenantId!),
        ),
      )
      .returning({ id: budgets.id });
    if (!row) throw new HttpError(404, 'Bütçe bulunamadı');

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'budget.delete',
      target_type: 'budgets',
      target_id: row?.id ?? String(req.params.id ?? ''),
      details: { soft_delete: true },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * AI bütçe önerisi — son 6 ayın payable_items kayıtlarına bakıp her kategori için
 * önerilen aylık bütçe tutarı + neden açıklaması döner.
 * Claude API kullanır; yoksa rule-based fallback (kategori ortalama + %10).
 */
budgetsRouter.post('/budgets/ai-suggest', requireAuth, requireTenant, async (req, res, next) => {
  try {
    await consumeRateLimit({
      identifier: `budget-ai:${req.authUser!.id}`,
      limit: 10,
      window_seconds: 3600,
    });
    const db = getDb();
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const fromISO = sixMonthsAgo.toISOString().slice(0, 10);

    // Kategori bazlı son 6 ay toplam + ortalama + max
    const rows = await db.execute(sql`
      SELECT
        category,
        COUNT(*) AS invoice_count,
        SUM(amount::numeric) AS total_amount,
        AVG(amount::numeric) AS avg_amount,
        MAX(amount::numeric) AS max_amount,
        COUNT(DISTINCT to_char(issue_date, 'YYYY-MM')) AS month_count
      FROM payable_items
      WHERE tenant_id = ${req.activeTenantId!}::uuid
        AND is_active = true
        AND category IS NOT NULL
        AND issue_date >= ${fromISO}
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 30
    `);

    const stats = ((rows.rows ?? rows) as Array<Record<string, unknown>>).map((r) => ({
      category: String(r.category),
      invoice_count: Number(r.invoice_count),
      total_6mo: Number(r.total_amount),
      monthly_avg: Number(r.total_amount) / Math.max(1, Number(r.month_count)),
      max: Number(r.max_amount),
      months_active: Number(r.month_count),
    }));

    interface Suggestion {
      category: string;
      category_label: string;
      suggested_monthly: number;
      reasoning: string;
      confidence: number;
    }

    // Rule-based fallback: aylık ortalama + %10 buffer
    function ruleBasedSuggest(): Suggestion[] {
      return stats.map((s) => ({
        category: s.category,
        category_label:
          CATEGORY_LABELS[s.category as PayableCategory] ?? s.category,
        suggested_monthly: Math.round(s.monthly_avg * 1.1),
        reasoning: `Son 6 ayda ${s.invoice_count} fatura, aylık ortalama ${s.monthly_avg.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL. %10 tampon ekleyerek önerildi.`,
        confidence: s.months_active >= 4 ? 0.7 : 0.5,
      }));
    }

    const anyAi =
      isConfigured.ai ||
      isConfigured.openai ||
      isConfigured.deepseek ||
      isConfigured.grok ||
      isConfigured.gemini;
    if (!anyAi || stats.length === 0) {
      res.json({ data: { suggestions: ruleBasedSuggest(), method: 'rule_based' } });
      return;
    }

    // Configured AI provider'a sor (claude/openai/deepseek/grok/gemini)
    try {
      const r = await generateText(
        {
          system:
            'Sen Sayman muhasebe asistanisin. Verilen son 6 ay kategori istatistiklerine gore ' +
            'ONUMUZDEKI AY icin makul aylik butce onerisi yap. Mevsimsellik, trend, max degerleri ' +
            'goz onunde tut. Yanit SADECE JSON: ' +
            '{"suggestions":[{"category":"<kategori>","suggested_monthly":<TL>,"reasoning":"<1-2 cumle Turkce>","confidence":<0-1>}]} ' +
            'Mevcut kategoriler: ' +
            PAYABLE_CATEGORIES.join(', '),
          prompt: `Veri: ${JSON.stringify(stats, null, 2)}\n\nHer kategori icin onerini ver. JSON'da kategori kodu (etiket degil) kullan.`,
          maxTokens: 1500,
          timeoutMs: 45_000,
        },
        {
          organizationId: req.activeOrgId ?? undefined,
          tenantId: req.activeTenantId ?? undefined,
        },
      );
      const text = r.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.json({ data: { suggestions: ruleBasedSuggest(), method: 'rule_based' } });
        return;
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        suggestions: Array<{
          category: string;
          suggested_monthly: number;
          reasoning: string;
          confidence: number;
        }>;
      };
      const enriched: Suggestion[] = (parsed.suggestions ?? [])
        .filter((s) => PAYABLE_CATEGORIES.includes(s.category as PayableCategory))
        .map((s) => ({
          category: s.category,
          category_label:
            CATEGORY_LABELS[s.category as PayableCategory] ?? s.category,
          suggested_monthly: Math.round(Number(s.suggested_monthly)),
          reasoning: String(s.reasoning ?? ''),
          confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.5))),
        }));
      res.json({ data: { suggestions: enriched, method: 'claude' } });
    } catch (err) {
      logger.error({ err }, 'AI budget suggest crashed');
      res.json({ data: { suggestions: ruleBasedSuggest(), method: 'rule_based' } });
    }
  } catch (err) {
    next(err);
  }
});

/** Bu ay + bir önceki ay karşılaştırma — dashboard widget için */
budgetsRouter.get(
  '/budgets/comparison',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const rows = await db
        .select()
        .from(budgets)
        .where(
          and(
            tenantScope(req, budgets.tenant_id),
            eq(budgets.is_active, true),
            eq(budgets.period, currentPeriod),
          ),
        );

      // N+1 fix — bu endpoint'te tüm bütçeler aynı period'da (currentPeriod),
      // dolayısıyla tüm category'lerin actual'ı tek GROUP BY ile çekilebilir.
      const result: Array<{
        id: string;
        category: string;
        category_label: string;
        planned: number;
        actual: number;
        usage_pct: number;
        over_budget: boolean;
      }> = [];

      if (rows.length > 0) {
        const range = periodToRange(rows[0]!.period, rows[0]!.period_kind);
        if (range) {
          const categories = [...new Set(rows.map((r) => r.category))];
          const totals = await db
            .select({
              category: payableItems.category,
              total: sql<string>`COALESCE(SUM(${payableItems.amount}::numeric), 0)`,
            })
            .from(payableItems)
            .where(
              and(
                tenantScope(req, payableItems.tenant_id),
                eq(payableItems.is_active, true),
                inArray(payableItems.category, categories),
                gte(payableItems.issue_date, range.from),
                lte(payableItems.issue_date, range.to),
              ),
            )
            .groupBy(payableItems.category);
          const byCategory = new Map(totals.map((t) => [t.category, Number(t.total)]));

          for (const b of rows) {
            const actual = byCategory.get(b.category) ?? 0;
            const planned = Number(b.planned_amount);
            result.push({
              id: b.id,
              category: b.category,
              category_label: CATEGORY_LABELS[b.category as PayableCategory] ?? b.category,
              planned,
              actual,
              usage_pct: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
              over_budget: actual > planned,
            });
          }
        }
      }

      result.sort((a, b) => b.usage_pct - a.usage_pct);
      res.json({ data: { period: currentPeriod, items: result } });
    } catch (err) {
      next(err);
    }
  },
);
