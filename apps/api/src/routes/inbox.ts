/**
 * /v1/inbox — Eylem-odaklı günlük "ne yapmam gerek" özeti.
 *
 * Dashboard birikmiş veriyi gösterir; inbox kullanıcının BUGÜN
 * ele alması gereken kayıtları öne çıkarır.
 *
 * Sections:
 *   - approvals_pending: çift-onaylı ödeme akışı bekliyorsa (faz sonra)
 *   - overdue_invoices: vadesi geçmiş + ödenmemiş
 *   - approaching_invoices: 0-7 gün içinde vadesi dolacak
 *   - expiring_guarantees: 30 gün içinde vade dolacak teminat
 *   - assigned_tasks: bana atanmış açık görevler
 *   - unread_anomalies: son 7 günde tetiklenmiş anomali bildirimi
 *
 * Filter: tenant context içinde + tenant seçilmediyse org-genel.
 */
import { and, desc, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  getDb,
  guarantees,
  notifications,
  payableItems,
  tasks,
} from '@sayman/db';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const inboxRouter = Router();

inboxRouter.get('/inbox', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const tenantId = req.saymanContext?.tenantId ?? null;
    const userId = req.authUser!.id;
    const db = getDb();

    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().slice(0, 10);
    const minus7 = new Date();
    minus7.setDate(minus7.getDate() - 7);

    // 1. Geciken faturalar
    const overdueRows = tenantId
      ? await db
          .select({
            id: payableItems.id,
            title: payableItems.title,
            amount: payableItems.amount,
            due_date: payableItems.due_date,
            supplier_name: payableItems.supplier_name,
          })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.is_active, true),
              eq(payableItems.status, 'overdue'),
            ),
          )
          .orderBy(desc(payableItems.amount))
          .limit(8)
      : [];

    // 2. Yaklaşan faturalar (0-7 gün)
    const approachingRows = tenantId
      ? await db
          .select({
            id: payableItems.id,
            title: payableItems.title,
            amount: payableItems.amount,
            due_date: payableItems.due_date,
            supplier_name: payableItems.supplier_name,
          })
          .from(payableItems)
          .where(
            and(
              eq(payableItems.tenant_id, tenantId),
              eq(payableItems.is_active, true),
              ne(payableItems.status, 'paid'),
              gte(payableItems.due_date, today),
              lte(payableItems.due_date, in7Str),
            ),
          )
          .orderBy(payableItems.due_date)
          .limit(8)
      : [];

    // 3. Vade dolacak teminat mektupları (30 gün)
    const expiringGuarantees = tenantId
      ? await db
          .select({
            id: guarantees.id,
            beneficiary_name: guarantees.beneficiary_name,
            letter_no: guarantees.letter_no,
            amount: guarantees.amount,
            expiry_date: guarantees.expiry_date,
          })
          .from(guarantees)
          .where(
            and(
              eq(guarantees.tenant_id, tenantId),
              eq(guarantees.is_active, true),
              eq(guarantees.status, 'active'),
              gte(guarantees.expiry_date, today),
              lte(guarantees.expiry_date, in30Str),
            ),
          )
          .orderBy(guarantees.expiry_date)
          .limit(5)
      : [];

    // 4. Bana atanmış açık görevler
    const assignedTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        due_date: tasks.due_date,
        priority: tasks.priority,
        status: tasks.status,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.assigned_to, userId),
          ne(tasks.status, 'done'),
          ne(tasks.status, 'cancelled'),
        ),
      )
      .orderBy(tasks.due_date)
      .limit(8);

    // 5. Son 7 günde tetiklenen okunmamış anomali bildirimleri
    const anomalyNotifs = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        priority: notifications.priority,
        action_url: notifications.action_url,
        created_at: notifications.created_at,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, userId),
          eq(notifications.category, 'audit'),
          isNull(notifications.read_at),
          gte(notifications.created_at, minus7),
        ),
      )
      .orderBy(desc(notifications.created_at))
      .limit(8);

    const totalCount =
      overdueRows.length +
      approachingRows.length +
      expiringGuarantees.length +
      assignedTasks.length +
      anomalyNotifs.length;

    res.json({
      data: {
        total_action_count: totalCount,
        sections: {
          overdue_invoices: overdueRows,
          approaching_invoices: approachingRows,
          expiring_guarantees: expiringGuarantees,
          assigned_tasks: assignedTasks,
          unread_anomalies: anomalyNotifs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
