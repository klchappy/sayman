/**
 * /v1/search/semantic — Voyage embeddings + pgvector cosine similarity.
 *
 * NOT: Bu özellik VOYAGE_API_KEY env yapılandırıldığında aktif olur. Yoksa 503.
 *
 *   GET /v1/search/semantic?q=...&limit=10
 *     → fatura listesi (en yakın anlam)
 *
 *   POST /v1/search/embed-pending
 *     → henüz embedding'i olmayan tüm fatura için Voyage'a istek + DB'ye yaz
 *     (admin only)
 *
 * Maliyet uyarısı: 10K fatura ≈ $0.001 (voyage-3-lite). Yine de admin tetiklesin.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, payableItems } from '@sayman/db';
import { isConfigured } from '../config/env';
import { embedQuery, embedText, toPgVector } from '../lib/embeddings';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const semanticSearchRouter = Router();

const querySchema = z.object({
  q: z.string().min(2).max(500),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

semanticSearchRouter.get('/search/semantic', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!isConfigured.embeddings) {
      throw new HttpError(
        503,
        'Semantic search yapılandırılmamış (VOYAGE_API_KEY)',
        'NO_EMBEDDINGS',
      );
    }
    const tenantId = req.saymanContext?.tenantId;
    if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

    const { q, limit } = querySchema.parse(req.query);
    const vec = await embedQuery(q);
    if (!vec) throw new HttpError(500, 'Embedding üretilemedi', 'EMBED_FAIL');
    const vecLit = toPgVector(vec);

    const rows = await getDb().execute(sql`
      SELECT
        pi.id, pi.title, pi.amount, pi.due_date, pi.status, pi.supplier_name, pi.category,
        1 - (pe.embedding <=> ${vecLit}::vector) AS similarity
      FROM payable_embeddings pe
      JOIN payable_items pi ON pi.id = pe.payable_id
      WHERE pe.tenant_id = ${tenantId}
        AND pi.is_active = true
      ORDER BY pe.embedding <=> ${vecLit}::vector ASC
      LIMIT ${limit}
    `);

    res.json({ data: rows.rows ?? rows });
  } catch (err) {
    next(err);
  }
});

semanticSearchRouter.post(
  '/search/embed-pending',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      if (!isConfigured.embeddings) {
        throw new HttpError(503, 'VOYAGE_API_KEY yapılandırılmamış', 'NO_EMBEDDINGS');
      }
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

      const limit = Math.min(Number(req.query.limit ?? 100), 200);
      const db = getDb();

      // Henüz embedding'i olmayan tenant fatura'lar
      const pending = await db.execute(sql`
        SELECT pi.id, pi.title, pi.supplier_name, pi.invoice_number, pi.notes, pi.category
        FROM payable_items pi
        LEFT JOIN payable_embeddings pe ON pe.payable_id = pi.id
        WHERE pi.tenant_id = ${tenantId}
          AND pi.is_active = true
          AND pe.payable_id IS NULL
        LIMIT ${limit}
      `);

      const list = (pending.rows ?? pending) as Array<{
        id: string;
        title: string;
        supplier_name?: string;
        invoice_number?: string;
        notes?: string;
        category?: string;
      }>;

      let success = 0;
      let failed = 0;
      for (const row of list) {
        const text = [
          row.title,
          row.supplier_name,
          row.invoice_number,
          row.notes,
          row.category,
        ]
          .filter(Boolean)
          .join(' | ');
        const r = await embedText(text);
        if (!r) {
          failed++;
          continue;
        }
        const vecLit = toPgVector(r.embedding);
        await db.execute(sql`
          INSERT INTO payable_embeddings (payable_id, tenant_id, embedding, source_text, model)
          VALUES (${row.id}, ${tenantId}, ${vecLit}::vector, ${text}, ${r.model})
          ON CONFLICT (payable_id) DO UPDATE
            SET embedding = EXCLUDED.embedding,
                source_text = EXCLUDED.source_text,
                updated_at = now()
        `);
        success++;
      }

      res.json({ data: { attempted: list.length, success, failed } });
    } catch (err) {
      next(err);
    }
  },
);
