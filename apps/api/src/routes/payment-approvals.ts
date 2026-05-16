/**
 * /v1/payment-approvals — Çift onaylı ödeme akışı.
 *
 *   POST   /v1/payment-approvals                → ödeme önerisi (>= eşik tutar)
 *   GET    /v1/payment-approvals?status=pending → bekleyen onaylar
 *   POST   /v1/payment-approvals/:id/approve    → onayla (asıl payment kaydı oluşur)
 *   POST   /v1/payment-approvals/:id/reject     → reddet (sebep zorunlu)
 *   POST   /v1/payment-approvals/:id/cancel     → kullanıcı kendi önerisini iptal eder
 *
 * Yetki:
 *   - Öneri: requireTenant + auth (herkes)
 *   - Onay/red: super_admin veya organization_admin
 *   - Kendi başlattığı öneriyi onaylayamaz (segregation of duties)
 *
 * Eşik: 50000 TRY (hardcoded MVP — sonra org_settings'e taşınır)
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  getDb,
  payableItems,
  paymentApprovals,
  paymentTransactions,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const paymentApprovalsRouter = Router();

export const APPROVAL_THRESHOLD_TRY = 50_000;

const proposeSchema = z.object({
  payable_id: z.string().uuid(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  method: z.string().min(1).max(50),
  reference_no: z.string().max(120).optional().nullable(),
  paid_at: z.string().min(8),
  note: z.string().max(500).optional().nullable(),
});

paymentApprovalsRouter.post(
  '/payment-approvals',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = proposeSchema.parse(req.body);
      const db = getDb();

      // Payable doğrula
      const [p] = await db
        .select()
        .from(payableItems)
        .where(
          and(eq(payableItems.id, body.payable_id), eq(payableItems.tenant_id, req.activeTenantId!)),
        );
      if (!p) throw new HttpError(404, 'Fatura bulunamadı');

      const [row] = await db
        .insert(paymentApprovals)
        .values({
          tenant_id: req.activeTenantId!,
          payable_id: body.payable_id,
          requested_by_user_id: req.authUser!.id,
          amount: body.amount,
          currency: body.currency,
          method: body.method,
          reference_no: body.reference_no ?? null,
          paid_at: body.paid_at,
          note: body.note ?? null,
        })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'payment_approval.request',
        target_type: 'payment_approvals',
        target_id: row?.id,
        details: { payable_id: body.payable_id, amount: body.amount },
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

paymentApprovalsRouter.get(
  '/payment-approvals',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const status = req.query.status ? String(req.query.status) : 'pending';
      const rows = await db
        .select({
          id: paymentApprovals.id,
          payable_id: paymentApprovals.payable_id,
          payable_title: payableItems.title,
          supplier_name: payableItems.supplier_name,
          requested_by_user_id: paymentApprovals.requested_by_user_id,
          approver_user_id: paymentApprovals.approver_user_id,
          amount: paymentApprovals.amount,
          currency: paymentApprovals.currency,
          method: paymentApprovals.method,
          reference_no: paymentApprovals.reference_no,
          paid_at: paymentApprovals.paid_at,
          note: paymentApprovals.note,
          status: paymentApprovals.status,
          decision_reason: paymentApprovals.decision_reason,
          decided_at: paymentApprovals.decided_at,
          created_at: paymentApprovals.created_at,
        })
        .from(paymentApprovals)
        .leftJoin(payableItems, eq(payableItems.id, paymentApprovals.payable_id))
        .where(
          and(
            eq(paymentApprovals.tenant_id, req.activeTenantId!),
            eq(paymentApprovals.status, status),
          ),
        )
        .orderBy(desc(paymentApprovals.created_at))
        .limit(100);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

const decisionSchema = z.object({
  reason: z.string().max(500).optional(),
});

paymentApprovalsRouter.post(
  '/payment-approvals/:id/approve',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Onaylama yetkisi yok', 'FORBIDDEN');
      }
      const { reason } = decisionSchema.parse(req.body);
      const db = getDb();

      // Tüm akış tek $transaction içinde + SELECT FOR UPDATE — paralel
      // approve/reject isteklerinde yarış engellendi.
      const apprId = String(req.params.id ?? '');
      const { appr, payment } = await db.transaction(async (tx) => {
        const lockRes = await tx.execute(sql`
          SELECT id, status, tenant_id, payable_id, paid_at, amount, method, reference_no,
                 requested_by_user_id
          FROM payment_approvals
          WHERE id = ${apprId}::uuid AND tenant_id = ${req.activeTenantId!}::uuid
          FOR UPDATE
        `);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = ((lockRes as any).rows ?? (lockRes as any))[0];
        if (!a) throw new HttpError(404, 'Onay bulunamadı');
        if (a.status !== 'pending') throw new HttpError(400, 'Bu onay zaten karar verilmiş');
        if (a.requested_by_user_id === req.authUser!.id) {
          throw new HttpError(
            400,
            'Kendi başlattığın ödemeyi onaylayamazsın (görevler ayrılığı)',
            'SELF_APPROVAL_FORBIDDEN',
          );
        }

        await tx
          .update(paymentApprovals)
          .set({
            status: 'approved',
            approver_user_id: req.authUser!.id,
            decision_reason: reason ?? null,
            decided_at: new Date(),
          })
          .where(eq(paymentApprovals.id, a.id));

        const [row] = await tx
          .insert(paymentTransactions)
          .values({
            tenant_id: a.tenant_id,
            payable_id: a.payable_id,
            paid_at: a.paid_at,
            amount: a.amount,
            method: a.method as any,
            reference_no: a.reference_no,
            status: 'approved',
          })
          .returning({ id: paymentTransactions.id });
        return { appr: a, payment: row };
      });

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'payment_approval.approve',
        target_type: 'payment_approvals',
        target_id: appr.id,
        details: { payable_id: appr.payable_id, amount: appr.amount, payment_id: payment?.id },
      });

      res.json({ data: { approval_id: appr.id, payment_id: payment?.id } });
    } catch (err) {
      next(err);
    }
  },
);

paymentApprovalsRouter.post(
  '/payment-approvals/:id/reject',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const { reason } = decisionSchema.parse(req.body);
      if (!reason || reason.length < 3) {
        throw new HttpError(400, 'Red sebebi zorunlu (min 3 karakter)');
      }
      const db = getDb();

      const [appr] = await db
        .select()
        .from(paymentApprovals)
        .where(
          and(
            eq(paymentApprovals.id, String(req.params.id ?? '')),
            eq(paymentApprovals.tenant_id, req.activeTenantId!),
          ),
        );
      if (!appr) throw new HttpError(404, 'Onay bulunamadı');
      if (appr.status !== 'pending') throw new HttpError(400, 'Zaten karar verilmiş');

      await db
        .update(paymentApprovals)
        .set({
          status: 'rejected',
          approver_user_id: req.authUser!.id,
          decision_reason: reason,
          decided_at: new Date(),
        })
        .where(eq(paymentApprovals.id, appr.id));

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'payment_approval.reject',
        target_type: 'payment_approvals',
        target_id: appr.id,
        details: { payable_id: appr.payable_id, reason },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

paymentApprovalsRouter.post(
  '/payment-approvals/:id/cancel',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [appr] = await db
        .select()
        .from(paymentApprovals)
        .where(
          and(
            eq(paymentApprovals.id, String(req.params.id ?? '')),
            eq(paymentApprovals.tenant_id, req.activeTenantId!),
          ),
        );
      if (!appr) throw new HttpError(404, 'Onay bulunamadı');
      if (appr.requested_by_user_id !== req.authUser!.id) {
        throw new HttpError(403, 'Sadece kendi önerini iptal edebilirsin');
      }
      if (appr.status !== 'pending') throw new HttpError(400, 'Zaten karar verilmiş');

      await db
        .update(paymentApprovals)
        .set({ status: 'cancelled', decided_at: new Date() })
        .where(eq(paymentApprovals.id, appr.id));

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'payment_approval.cancel',
        target_type: 'payment_approvals',
        target_id: appr.id,
        details: { payable_id: appr.payable_id },
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
