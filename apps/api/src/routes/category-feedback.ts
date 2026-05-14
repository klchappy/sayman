/**
 * /v1/category-feedback — kategori düzeltme kaydı + bulk AI kategorize.
 *
 * Kullanıcı payable kategorisini değiştirirken UI buraya POST atar.
 * Toplanan veri ileride keyword listesini genişletmek için kullanılır.
 *
 * /v1/category-feedback/bulk-categorize — kategorisi olmayan tüm payable'ları
 *   önce rule-based suggestCategory ile dene; uyumsuzları Claude API'ye yolla.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { categoryFeedback, getDb, payableItems } from '@sayman/db';
import {
  CATEGORY_LABELS,
  PAYABLE_CATEGORIES,
  suggestCategory,
  type PayableCategory,
} from '@sayman/shared';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const recordSchema = z.object({
  payable_id: z.string().uuid().optional().nullable(),
  suggested_category: z.string().max(64).optional().nullable(),
  actual_category: z.enum(PAYABLE_CATEGORIES),
  source_text: z.string().max(500).optional().nullable(),
});

export const categoryFeedbackRouter = Router();

categoryFeedbackRouter.post(
  '/category-feedback',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = recordSchema.parse(req.body);
      const db = getDb();

      // payable_id varsa kategoriyi de güncelle
      if (body.payable_id) {
        await db
          .update(payableItems)
          .set({ category: body.actual_category, updated_at: new Date() })
          .where(
            and(
              eq(payableItems.id, body.payable_id),
              eq(payableItems.tenant_id, req.activeTenantId!),
            ),
          );
      }

      const [row] = await db
        .insert(categoryFeedback)
        .values({
          tenant_id: req.activeTenantId!,
          payable_id: body.payable_id ?? null,
          suggested_category: body.suggested_category ?? null,
          actual_category: body.actual_category,
          source_text: body.source_text ?? null,
          user_id: req.authUser?.id ?? null,
        })
        .returning({ id: categoryFeedback.id });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// Bulk AI kategorize: kategorisi olmayan payable'ları topla,
// rule-based dene → uyumsuzları Claude'a yolla → güncelle
categoryFeedbackRouter.post(
  '/category-feedback/bulk-categorize',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const useAi = Boolean(req.body?.use_ai) && isConfigured.ai;
      const dryRun = Boolean(req.body?.dry_run);
      const limit = Math.min(Number(req.body?.limit ?? 100), 500);
      const db = getDb();

      const pending = await db
        .select({
          id: payableItems.id,
          title: payableItems.title,
          supplier_name: payableItems.supplier_name,
          invoice_number: payableItems.invoice_number,
          notes: payableItems.notes,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, req.activeTenantId!),
            eq(payableItems.is_active, true),
            isNull(payableItems.category),
          ),
        )
        .limit(limit);

      const proposals: Array<{
        id: string;
        title: string;
        category: PayableCategory;
        source: 'rule' | 'ai';
        confidence: number;
      }> = [];
      const aiCandidates: typeof pending = [];

      for (const p of pending) {
        const sug = suggestCategory(p.title, p.supplier_name, p.notes);
        if (sug && sug.confidence >= 0.35) {
          proposals.push({
            id: p.id,
            title: p.title,
            category: sug.category,
            source: 'rule',
            confidence: sug.confidence,
          });
        } else if (useAi) {
          aiCandidates.push(p);
        }
      }

      // AI fallback — toplu prompt (10'arlı batch)
      if (useAi && aiCandidates.length > 0) {
        const BATCH = 10;
        for (let i = 0; i < aiCandidates.length; i += BATCH) {
          const batch = aiCandidates.slice(i, i + BATCH);
          const items = batch.map((p, idx) => ({
            idx,
            title: p.title,
            supplier: p.supplier_name,
            invoice: p.invoice_number,
            notes: p.notes,
          }));
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': env.ANTHROPIC_API_KEY!,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                system:
                  'Sen Sayman muhasebe asistanisin. Verilen JSON listedeki her fatura icin ' +
                  'asagidaki kategorilerden BIRINI sec: ' +
                  PAYABLE_CATEGORIES.join(', ') +
                  '. Yanit SADECE asagidaki JSON formatinda olsun, baska metin EKLEME: ' +
                  '{"results":[{"idx":<idx>,"category":"<kategori>","confidence":<0-1 arasi>}]}',
                messages: [
                  {
                    role: 'user',
                    content: JSON.stringify(items),
                  },
                ],
              }),
            });
            if (!res.ok) {
              logger.warn({ status: res.status }, 'bulk ai categorize: non-200');
              continue;
            }
            const data = (await res.json()) as {
              content: Array<{ type: string; text?: string }>;
            };
            const text = data.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text ?? '')
              .join('\n')
              .trim();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) continue;
            const parsed = JSON.parse(jsonMatch[0]) as {
              results: Array<{ idx: number; category: string; confidence: number }>;
            };
            for (const r of parsed.results ?? []) {
              const p = batch[r.idx];
              if (!p) continue;
              if (!PAYABLE_CATEGORIES.includes(r.category as PayableCategory)) continue;
              if (Number(r.confidence) < 0.4) continue;
              proposals.push({
                id: p.id,
                title: p.title,
                category: r.category as PayableCategory,
                source: 'ai',
                confidence: Number(r.confidence),
              });
            }
          } catch (err) {
            logger.error({ err }, 'bulk ai categorize batch failed');
          }
        }
      }

      // dry_run yoksa güncelle
      let applied = 0;
      if (!dryRun) {
        for (const p of proposals) {
          await db
            .update(payableItems)
            .set({ category: p.category, updated_at: new Date() })
            .where(
              and(
                eq(payableItems.id, p.id),
                eq(payableItems.tenant_id, req.activeTenantId!),
              ),
            );
          applied++;
        }
        await auditFromRequest(req, {
          organization_id: req.activeOrgId!,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'category.bulk_categorize',
          details: {
            scanned: pending.length,
            proposed: proposals.length,
            applied,
            ai_used: useAi,
          },
        });
      }

      res.json({
        data: {
          scanned: pending.length,
          rule_matched: proposals.filter((p) => p.source === 'rule').length,
          ai_matched: proposals.filter((p) => p.source === 'ai').length,
          ai_used: useAi,
          unmatched: pending.length - proposals.length,
          applied,
          dry_run: dryRun,
          proposals: proposals.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            category_label: CATEGORY_LABELS[p.category],
            source: p.source,
            confidence: Math.round(p.confidence * 100) / 100,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Analytics: hangi kategori en çok yanlış öneriliyor (admin için)
categoryFeedbackRouter.get(
  '/category-feedback/stats',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db.execute(sql`
        SELECT
          suggested_category,
          actual_category,
          COUNT(*) AS count,
          MAX(created_at) AS last_seen
        FROM category_feedback
        WHERE tenant_id = ${req.activeTenantId!}
          AND suggested_category IS NOT NULL
          AND suggested_category != actual_category
        GROUP BY suggested_category, actual_category
        ORDER BY count DESC
        LIMIT 20
      `);
      const list = (rows.rows ?? rows) as Array<Record<string, unknown>>;
      res.json({
        data: list.map((r) => ({
          suggested: String(r.suggested_category),
          actual: String(r.actual_category),
          count: Number(r.count),
          last_seen: r.last_seen,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
