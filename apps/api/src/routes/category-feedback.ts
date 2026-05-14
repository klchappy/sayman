/**
 * /v1/category-feedback — kategori düzeltme kaydı.
 *
 * Kullanıcı payable kategorisini değiştirirken UI buraya POST atar.
 * Toplanan veri ileride keyword listesini genişletmek için kullanılır.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { categoryFeedback, getDb, payableItems } from '@sayman/db';
import { PAYABLE_CATEGORIES } from '@sayman/shared';
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
