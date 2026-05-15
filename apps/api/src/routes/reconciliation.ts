/**
 * /v1/reconciliation — Mutabakat: cari ↔ Sayman + ödeme ↔ fatura eşleştirme.
 *
 *   GET /v1/reconciliation/cari/:id     → Sayman'da olan ama ERP cari ekstresinde
 *                                          olmayan (ya da tam tersi) hareketleri listele
 *   GET /v1/reconciliation/payments     → ödenmemiş payable + henüz eşleşmemiş payment
 *
 * Matching kuralları:
 *   - Aynı tutar (±0.01 TL tolerans)
 *   - Aynı tarih ±3 gün
 *   - Description'da invoice_number geçiyorsa confidence boost
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  cariAccounts,
  cariMovements,
  getDb,
  payableItems,
  paymentTransactions,
} from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const reconciliationRouter = Router();

interface MatchResult {
  source: 'sayman' | 'erp';
  id: string;
  date: string;
  amount: number;
  description: string;
  matched_with_id: string | null;
  confidence: number;
}

/** Tek bir cari için Sayman payments + ERP movements'i eşleştir */
reconciliationRouter.get(
  '/reconciliation/cari/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [cari] = await db
        .select()
        .from(cariAccounts)
        .where(
          and(
            eq(cariAccounts.id, String(req.params.id ?? '')),
            eq(cariAccounts.tenant_id, req.activeTenantId!),
          ),
        );
      if (!cari) throw new HttpError(404, 'Cari bulunamadı');

      // ERP'den gelen tüm hareketler
      const erpMovements = await db
        .select()
        .from(cariMovements)
        .where(eq(cariMovements.cari_account_id, cari.id))
        .orderBy(asc(cariMovements.movement_date));

      // Sayman tarafında bu carinin supplier_name'i ile eşleşen ödemeler
      // (payable_items.supplier_name = cari.name + payments üzerinden)
      const saymanPayments = await db.execute(sql`
        SELECT pt.id, pt.paid_at, pt.amount, pt.reference_no,
               pi.title, pi.invoice_number, pi.supplier_name
        FROM payment_transactions pt
        INNER JOIN payable_items pi ON pi.id = pt.payable_id
        WHERE pi.tenant_id = ${req.activeTenantId!}::uuid
          AND pt.is_active = true
          AND pi.supplier_name = ${cari.name}
        ORDER BY pt.paid_at ASC
      `);
      const saymanList = (saymanPayments.rows ?? saymanPayments) as Array<{
        id: string;
        paid_at: string;
        amount: string;
        reference_no: string | null;
        title: string;
        invoice_number: string | null;
        supplier_name: string;
      }>;

      // Eşleştirme — basit greedy: her Sayman payment için en iyi ERP movement'ı bul
      const matched = new Set<string>(); // ERP movement ids that got matched
      const saymanResults: MatchResult[] = [];

      for (const sp of saymanList) {
        const spAmount = Number(sp.amount);
        const spDate = new Date(sp.paid_at);

        let bestMatch: { id: string; confidence: number } | null = null;
        for (const em of erpMovements) {
          if (matched.has(em.id)) continue;
          const credit = Number(em.credit);
          const debit = Number(em.debit);
          const erpAmount = credit > 0 ? credit : debit; // ödeme cari'ye credit gider
          if (Math.abs(erpAmount - spAmount) > 0.01) continue;
          const emDate = new Date(em.movement_date);
          const dayDiff = Math.abs((spDate.getTime() - emDate.getTime()) / 86_400_000);
          if (dayDiff > 5) continue;
          let confidence = 1 - dayDiff / 10; // daha az gün → daha yüksek confidence
          // Açıklama / belge no eşleşmesi
          if (sp.invoice_number && em.document_no === sp.invoice_number) confidence = 1;
          else if (
            sp.invoice_number &&
            em.description?.toLowerCase().includes(sp.invoice_number.toLowerCase())
          )
            confidence = Math.min(1, confidence + 0.2);
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { id: em.id, confidence };
          }
        }
        if (bestMatch && bestMatch.confidence >= 0.5) {
          matched.add(bestMatch.id);
        }
        saymanResults.push({
          source: 'sayman',
          id: sp.id,
          date: sp.paid_at,
          amount: spAmount,
          description: `${sp.title}${sp.invoice_number ? ` #${sp.invoice_number}` : ''}`,
          matched_with_id: bestMatch?.id ?? null,
          confidence: bestMatch?.confidence ?? 0,
        });
      }

      // Eşleşmeyen ERP hareketleri
      const erpResults: MatchResult[] = erpMovements
        .filter((em) => !matched.has(em.id))
        .map((em) => {
          const credit = Number(em.credit);
          const debit = Number(em.debit);
          return {
            source: 'erp' as const,
            id: em.id,
            date: em.movement_date,
            amount: credit > 0 ? credit : debit,
            description: em.description ?? em.document_no ?? '-',
            matched_with_id: null,
            confidence: 0,
          };
        });

      const stats = {
        sayman_total: saymanResults.length,
        sayman_matched: saymanResults.filter((s) => s.matched_with_id).length,
        sayman_unmatched: saymanResults.filter((s) => !s.matched_with_id).length,
        erp_total: erpMovements.length,
        erp_unmatched: erpResults.length,
      };

      res.json({
        data: {
          cari: { id: cari.id, name: cari.name },
          stats,
          sayman_payments: saymanResults,
          erp_movements_unmatched: erpResults,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
