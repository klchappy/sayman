/**
 * /v1/activity/:type/:id — Bir kayıt için aktivite zaman çizelgesi.
 *
 * audit_log tablosundan ilgili kayda dair tüm işlemleri çıkarır:
 *   - oluşturuldu / güncellendi / silindi
 *   - kim yaptı
 *   - hangi alanlar değişti (details jsonb)
 *
 * Bonus: payable için payment_transactions'ları da timeline'a ekler.
 */
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  auditLog,
  getDb,
  payableItems,
  paymentTransactions,
  users,
} from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const activityTimelineRouter = Router();

interface TimelineEvent {
  id: string;
  kind: 'audit' | 'payment' | 'creation';
  timestamp: string;
  title: string;
  description?: string;
  actor_email?: string | null;
  details?: Record<string, unknown>;
}

activityTimelineRouter.get(
  '/activity/:type/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const type = String(req.params.type ?? '');
      const id = String(req.params.id ?? '');
      if (!type || !id) throw new HttpError(400, 'type + id zorunlu');

      const db = getDb();
      const events: TimelineEvent[] = [];

      // 1. Audit log entry'leri (target_table + target_id)
      const auditRows = await db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          actor_email: users.email,
          before_data: auditLog.before_data,
          after_data: auditLog.after_data,
          notes: auditLog.notes,
          created_at: auditLog.created_at,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actor_id))
        .where(
          and(
            eq(auditLog.target_table, type),
            eq(auditLog.target_id, id),
            eq(auditLog.organization_id, req.activeOrgId!),
          ),
        )
        .orderBy(desc(auditLog.created_at))
        .limit(100);

      for (const row of auditRows) {
        events.push({
          id: row.id,
          kind: 'audit',
          timestamp: row.created_at.toISOString(),
          title: row.action,
          description: row.notes ?? undefined,
          actor_email: row.actor_email,
          details: {
            before: row.before_data,
            after: row.after_data,
          },
        });
      }

      // 2. Payable için: kuruluş + payment_transactions
      if (type === 'payable_items') {
        const [payable] = await db
          .select({
            id: payableItems.id,
            title: payableItems.title,
            created_at: payableItems.created_at,
            created_by: payableItems.created_by,
            status: payableItems.status,
            amount: payableItems.amount,
            paid_amount: payableItems.paid_amount,
          })
          .from(payableItems)
          .where(eq(payableItems.id, id));

        if (payable) {
          events.push({
            id: `creation:${payable.id}`,
            kind: 'creation',
            timestamp: payable.created_at.toISOString(),
            title: 'Fatura oluşturuldu',
            description: `Tutar: ${Number(payable.amount).toLocaleString('tr-TR')} TL`,
          });
        }

        const payments = await db
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.payable_id, id))
          .orderBy(desc(paymentTransactions.created_at));

        for (const p of payments) {
          events.push({
            id: `payment:${p.id}`,
            kind: 'payment',
            timestamp: (p.created_at ?? new Date()).toISOString(),
            title: `Ödeme: ${Number(p.amount).toLocaleString('tr-TR')} TL (${p.method})`,
            description: p.reference_no ? `Ref: ${p.reference_no}` : undefined,
            details: { paid_at: p.paid_at, status: p.status },
          });
        }
      }

      // Sırala: yeniden eskiye
      events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

      res.json({ data: events });
    } catch (err) {
      next(err);
    }
  },
);
