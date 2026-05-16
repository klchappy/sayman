/**
 * embed-payables cron — saatlik. OPENAI_API_KEY varsa
 * embeddings'i olmayan payable_items'a OpenAI ile vektör üretir
 * (text-embedding-3-small, dim=1024).
 *
 * Idempotent: ON CONFLICT (payable_id) UPDATE.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@sayman/db';
import { logger } from '../config/logger';
import { embedText, toPgVector } from '../lib/embeddings';

export interface EmbedResult {
  attempted: number;
  success: number;
  failed: number;
  skipped_no_key: number;
}

const BATCH_LIMIT = 100;

export async function runEmbedPayables(): Promise<EmbedResult> {
  // env yoksa bile DB'de UI-saved key olabilir — embedText her satır için runtime'da
  // org-level lookup yapacak; başarısız olursa skip.
  const db = getDb();
  const pending = await db.execute(sql`
    SELECT pi.id, pi.tenant_id, t.organization_id, pi.title, pi.supplier_name, pi.invoice_number, pi.notes, pi.category
    FROM payable_items pi
    JOIN tenants t ON t.id = pi.tenant_id
    LEFT JOIN payable_embeddings pe ON pe.payable_id = pi.id
    WHERE pi.is_active = true
      AND pe.payable_id IS NULL
    LIMIT ${BATCH_LIMIT}
  `);

  const list = (pending.rows ?? pending) as Array<{
    id: string;
    tenant_id: string;
    organization_id: string;
    title: string;
    supplier_name?: string;
    invoice_number?: string;
    notes?: string;
    category?: string;
  }>;

  const result: EmbedResult = {
    attempted: list.length,
    success: 0,
    failed: 0,
    skipped_no_key: 0,
  };

  for (const row of list) {
    const text = [row.title, row.supplier_name, row.invoice_number, row.notes, row.category]
      .filter(Boolean)
      .join(' | ');
    const r = await embedText(text, {
      organizationId: row.organization_id,
      tenantId: row.tenant_id,
    });
    if (!r) {
      result.failed++;
      continue;
    }
    try {
      await db.execute(sql`
        INSERT INTO payable_embeddings (payable_id, tenant_id, embedding, source_text, model)
        VALUES (${row.id}, ${row.tenant_id}, ${toPgVector(r.embedding)}::vector, ${text}, ${r.model})
        ON CONFLICT (payable_id) DO UPDATE
          SET embedding = EXCLUDED.embedding,
              source_text = EXCLUDED.source_text,
              updated_at = now()
      `);
      result.success++;
    } catch (err) {
      logger.error({ err, id: row.id }, 'embed insert failed');
      result.failed++;
    }
  }

  if (list.length > 0) logger.info(result, 'embed-payables completed');
  return result;
}
