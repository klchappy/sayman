/**
 * /v1/recurring-detect — Bir payable için "düzenli (tekrar eden) mi?" tespiti.
 *
 *   GET /v1/recurring-detect/payable/:id
 *     → aynı supplier + benzer tutar son 6 ayda 2+ kez geçtiyse "recurring" diye işaretle
 *     → ortalama aylık aralık, ortalama tutar, son N kaydı dön
 *
 * Sonuç: UI "Bu fatura abonelik gibi duruyor. Subscriptions'a çevirir misin?" sorabilir.
 *
 * Rule:
 *   - aynı supplier + amount ±10%
 *   - son 6 ay içinde 2+ kayıt
 *   - kayıtlar arasında ortalama 25-35 gün → "monthly"
 *   - kayıtlar arasında ortalama 85-95 gün → "quarterly"
 *   - kayıtlar arasında ortalama 350-380 gün → "yearly"
 */
import { and, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, payableItems } from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const recurringDetectRouter = Router();

interface RecurringResult {
  is_recurring: boolean;
  confidence: number;
  cadence: 'monthly' | 'quarterly' | 'yearly' | 'irregular' | null;
  occurrences: number;
  avg_interval_days: number | null;
  avg_amount: number;
  recent_history: Array<{
    id: string;
    title: string;
    amount: number;
    created_at: string;
    due_date: string | null;
  }>;
}

function classifyCadence(avgDays: number | null): RecurringResult['cadence'] {
  if (avgDays == null) return null;
  if (avgDays >= 25 && avgDays <= 35) return 'monthly';
  if (avgDays >= 85 && avgDays <= 95) return 'quarterly';
  if (avgDays >= 350 && avgDays <= 380) return 'yearly';
  return 'irregular';
}

recurringDetectRouter.get(
  '/recurring-detect/payable/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const tenantId = req.saymanContext?.tenantId;
      if (!tenantId) throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');

      const db = getDb();
      const [p] = await db
        .select()
        .from(payableItems)
        .where(
          and(eq(payableItems.id, String(req.params.id ?? '')), eq(payableItems.tenant_id, tenantId)),
        );
      if (!p) throw new HttpError(404, 'Fatura bulunamadı');

      const result: RecurringResult = {
        is_recurring: false,
        confidence: 0,
        cadence: null,
        occurrences: 1,
        avg_interval_days: null,
        avg_amount: Number(p.amount),
        recent_history: [
          {
            id: p.id,
            title: p.title,
            amount: Number(p.amount),
            created_at: p.created_at?.toISOString() ?? '',
            due_date: p.due_date,
          },
        ],
      };

      if (!p.supplier_name) {
        res.json({ data: result });
        return;
      }

      const amt = Number(p.amount);
      const minAmt = amt * 0.9;
      const maxAmt = amt * 1.1;

      // 6 ay içinde aynı supplier + amount ±10%
      // NOT: parameterized sql tag — string interpolation SQL injection riski.
      const rows = await db.execute(sql`
        SELECT id, title, amount, created_at, due_date
        FROM payable_items
        WHERE tenant_id = ${tenantId}::uuid
          AND is_active = true
          AND supplier_name = ${p.supplier_name}
          AND amount::numeric BETWEEN ${minAmt} AND ${maxAmt}
          AND created_at > NOW() - INTERVAL '6 months'
        ORDER BY created_at ASC
        LIMIT 50
      `);
      const list = (rows.rows ?? rows) as Array<{
        id: string;
        title: string;
        amount: string;
        created_at: string;
        due_date: string | null;
      }>;

      result.occurrences = list.length;
      result.recent_history = list.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        amount: Number(r.amount),
        created_at: String(r.created_at),
        due_date: r.due_date,
      }));

      if (list.length >= 2) {
        const amounts = list.map((r) => Number(r.amount));
        result.avg_amount =
          amounts.reduce((a, b) => a + b, 0) / amounts.length;

        const intervals: number[] = [];
        for (let i = 1; i < list.length; i++) {
          const a = new Date(list[i - 1]!.created_at).getTime();
          const b = new Date(list[i]!.created_at).getTime();
          intervals.push((b - a) / 86_400_000);
        }
        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        result.avg_interval_days = Math.round(avgInterval * 10) / 10;
        result.cadence = classifyCadence(avgInterval);

        const isRegular = result.cadence !== 'irregular' && result.cadence !== null;
        result.is_recurring = isRegular && list.length >= 2;
        result.confidence = isRegular
          ? Math.min(1, list.length / 4) // 4+ kayıt → %100
          : 0.3;
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
