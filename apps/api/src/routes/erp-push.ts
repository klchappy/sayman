/**
 * /v1/erp/push/* — Sayman → ERP veri itme (çift yönlü entegrasyon).
 *
 * Akış:
 *   1. Kullanıcı bir payable oluşturur
 *   2. UI "ERP'ye gönder" butonuna tıklar (veya cron toplu push çalışır)
 *   3. /v1/erp/connections/:id/push/payable/:payableId çağrılır
 *   4. Adapter.pushInvoice çağırılır
 *   5. Dönen external_id payable_items.erp_external_id'ye yazılır
 *
 * Idempotent: erp_external_id varsa skip (re-push için ?force=true).
 *
 *   POST /v1/erp/connections/:id/push/payable/:payableId   → tek fatura
 *   POST /v1/erp/connections/:id/push/payment/:paymentId   → tek ödeme
 *   POST /v1/erp/connections/:id/push-pending              → tüm bekleyenleri push et
 *   GET  /v1/erp/connections/:id/push-status               → push istatistikleri
 */
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import {
  erpConnections,
  getDb,
  payableItems,
  paymentTransactions,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { getAdapter } from '../lib/erp';
import { logger } from '../config/logger';
import { decryptSecret } from '../lib/secret-box';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const erpPushRouter = Router();

function requireAdmin(role?: string | null) {
  if (!['super_admin', 'organization_admin'].includes(role ?? '')) {
    throw new HttpError(403, 'ERP push için yetki yok', 'FORBIDDEN');
  }
}

async function getConnectionWithAdapter(connId: string, orgId: string) {
  const db = getDb();
  const [conn] = await db
    .select()
    .from(erpConnections)
    .where(and(eq(erpConnections.id, connId), eq(erpConnections.organization_id, orgId)));
  if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');
  const adapter = getAdapter(conn.provider);
  if (!adapter) throw new HttpError(400, `Bilinmeyen sağlayıcı: ${conn.provider}`);
  const config = JSON.parse(decryptSecret(conn.config_encrypted));
  return { conn, adapter, config };
}

erpPushRouter.post(
  '/erp/connections/:id/push/payable/:payableId',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      requireAdmin(req.effectiveRole);
      const force = String(req.query.force ?? '') === 'true';
      const db = getDb();
      const { conn, adapter, config } = await getConnectionWithAdapter(
        String(req.params.id ?? ''),
        req.activeOrgId!,
      );

      if (!adapter.pushInvoice) {
        throw new HttpError(
          501,
          `${adapter.label} push henüz desteklenmiyor`,
          'NOT_IMPLEMENTED',
        );
      }

      if (!conn.tenant_id) {
        throw new HttpError(400, 'Bağlantıya tenant atanmalı (push için)');
      }

      const [p] = await db
        .select()
        .from(payableItems)
        .where(
          and(
            eq(payableItems.id, String(req.params.payableId ?? '')),
            eq(payableItems.tenant_id, conn.tenant_id),
          ),
        );
      if (!p) throw new HttpError(404, 'Fatura bulunamadı');

      if (p.erp_external_id && p.erp_push_status === 'pushed' && !force) {
        res.json({
          data: {
            already_pushed: true,
            external_id: p.erp_external_id,
            push_status: p.erp_push_status,
          },
        });
        return;
      }

      try {
        const result = await adapter.pushInvoice(
          config,
          {
            payable_id: p.id,
            supplier_name: p.supplier_name,
            cari_external_id: null,
            title: p.title,
            invoice_number: p.invoice_number,
            amount: Number(p.amount),
            currency: p.currency,
            issue_date: p.issue_date,
            due_date: p.due_date,
            category: p.category,
            notes: p.notes,
          },
          { tenantId: conn.tenant_id, connectionId: conn.id },
        );

        await db
          .update(payableItems)
          .set({
            erp_connection_id: conn.id,
            erp_external_id: result.external_id,
            erp_push_status: 'pushed',
            erp_pushed_at: new Date(),
            erp_push_error: null,
            updated_at: new Date(),
          })
          .where(eq(payableItems.id, p.id));

        await auditFromRequest(req, {
          organization_id: req.activeOrgId!,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'erp.push.payable',
          target_type: 'payable_items',
          target_id: p.id,
          details: {
            connection_id: conn.id,
            provider: conn.provider,
            external_id: result.external_id,
          },
        });

        res.json({
          data: {
            external_id: result.external_id,
            external_url: result.external_url ?? null,
            push_status: 'pushed',
          },
        });
      } catch (err) {
        const errMsg = (err as Error).message;
        await db
          .update(payableItems)
          .set({
            erp_connection_id: conn.id,
            erp_push_status: 'failed',
            erp_push_error: errMsg.slice(0, 500),
            updated_at: new Date(),
          })
          .where(eq(payableItems.id, p.id));
        throw new HttpError(502, `ERP push başarısız: ${errMsg}`, 'PUSH_FAIL');
      }
    } catch (err) {
      next(err);
    }
  },
);

erpPushRouter.post(
  '/erp/connections/:id/push/payment/:paymentId',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      requireAdmin(req.effectiveRole);
      const db = getDb();
      const { conn, adapter, config } = await getConnectionWithAdapter(
        String(req.params.id ?? ''),
        req.activeOrgId!,
      );

      if (!adapter.pushPayment) {
        throw new HttpError(501, `${adapter.label} ödeme push desteklemiyor`);
      }
      if (!conn.tenant_id) throw new HttpError(400, 'Tenant zorunlu');

      const [pmt] = await db
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.id, String(req.params.paymentId ?? '')),
            eq(paymentTransactions.tenant_id, conn.tenant_id),
          ),
        );
      if (!pmt) throw new HttpError(404, 'Ödeme bulunamadı');

      // İlgili payable'ın ERP external_id'sini al
      const [payable] = await db
        .select({ erp_external_id: payableItems.erp_external_id })
        .from(payableItems)
        .where(eq(payableItems.id, pmt.payable_id));
      if (!payable?.erp_external_id) {
        throw new HttpError(
          400,
          'Önce ilgili fatura ERP\'ye push edilmeli',
          'INVOICE_NOT_PUSHED',
        );
      }

      try {
        const result = await adapter.pushPayment(
          config,
          {
            payment_id: pmt.id,
            related_invoice_external_id: payable.erp_external_id,
            paid_at: pmt.paid_at,
            amount: Number(pmt.amount),
            currency: 'TRY',
            method: pmt.method,
            reference_no: pmt.reference_no,
            notes: pmt.notes,
          },
          { tenantId: conn.tenant_id, connectionId: conn.id },
        );

        await db
          .update(paymentTransactions)
          .set({
            erp_connection_id: conn.id,
            erp_external_id: result.external_id,
            erp_push_status: 'pushed',
            erp_pushed_at: new Date(),
            erp_push_error: null,
            updated_at: new Date(),
          })
          .where(eq(paymentTransactions.id, pmt.id));

        res.json({ data: { external_id: result.external_id, push_status: 'pushed' } });
      } catch (err) {
        const errMsg = (err as Error).message;
        await db
          .update(paymentTransactions)
          .set({
            erp_connection_id: conn.id,
            erp_push_status: 'failed',
            erp_push_error: errMsg.slice(0, 500),
          })
          .where(eq(paymentTransactions.id, pmt.id));
        throw new HttpError(502, `Ödeme push başarısız: ${errMsg}`);
      }
    } catch (err) {
      next(err);
    }
  },
);

erpPushRouter.post(
  '/erp/connections/:id/push-pending',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      requireAdmin(req.effectiveRole);
      const db = getDb();
      const { conn, adapter, config } = await getConnectionWithAdapter(
        String(req.params.id ?? ''),
        req.activeOrgId!,
      );

      if (!adapter.pushInvoice) throw new HttpError(501, `${adapter.label} push desteklemiyor`);
      if (!conn.tenant_id) throw new HttpError(400, 'Tenant zorunlu');

      const limit = Math.min(Number(req.body?.limit ?? 50), 200);

      // Henüz push edilmemiş veya hata almış fatura
      const pending = await db
        .select()
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, conn.tenant_id),
            eq(payableItems.is_active, true),
            or(
              isNull(payableItems.erp_external_id),
              eq(payableItems.erp_push_status, 'failed'),
            ),
          ),
        )
        .limit(limit);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const p of pending) {
        try {
          const result = await adapter.pushInvoice(
            config,
            {
              payable_id: p.id,
              supplier_name: p.supplier_name,
              cari_external_id: null,
              title: p.title,
              invoice_number: p.invoice_number,
              amount: Number(p.amount),
              currency: p.currency,
              issue_date: p.issue_date,
              due_date: p.due_date,
              category: p.category,
              notes: p.notes,
            },
            { tenantId: conn.tenant_id, connectionId: conn.id },
          );
          await db
            .update(payableItems)
            .set({
              erp_connection_id: conn.id,
              erp_external_id: result.external_id,
              erp_push_status: 'pushed',
              erp_pushed_at: new Date(),
              erp_push_error: null,
              updated_at: new Date(),
            })
            .where(eq(payableItems.id, p.id));
          success++;
        } catch (err) {
          const errMsg = (err as Error).message;
          await db
            .update(payableItems)
            .set({
              erp_connection_id: conn.id,
              erp_push_status: 'failed',
              erp_push_error: errMsg.slice(0, 500),
            })
            .where(eq(payableItems.id, p.id));
          failed++;
          if (errors.length < 5) errors.push(`${p.title}: ${errMsg.slice(0, 80)}`);
          logger.warn({ err, payableId: p.id }, 'ERP push-pending failed for payable');
        }
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'erp.push.bulk',
        target_type: 'erp_connections',
        target_id: conn.id,
        details: { attempted: pending.length, success, failed },
      });

      res.json({
        data: { attempted: pending.length, success, failed, errors },
      });
    } catch (err) {
      next(err);
    }
  },
);

erpPushRouter.get(
  '/erp/connections/:id/push-status',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [conn] = await db
        .select({ id: erpConnections.id, tenant_id: erpConnections.tenant_id })
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.id ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');
      if (!conn.tenant_id) {
        res.json({ data: { pushed: 0, pending: 0, failed: 0 } });
        return;
      }

      const all = await db
        .select({
          status: payableItems.erp_push_status,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, conn.tenant_id),
            eq(payableItems.is_active, true),
          ),
        );

      const stats = {
        total: all.length,
        pushed: all.filter((r) => r.status === 'pushed').length,
        failed: all.filter((r) => r.status === 'failed').length,
        pending: all.filter((r) => !r.status).length,
      };

      res.json({ data: stats });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * /v1/erp/connections/:id/push-failures
 * ERP push'u başarısız olan tüm payable'ları detaylı listele.
 * Önceden push-status sadece sayı döndürüyordu — kullanıcı hangi fatura niye
 * push edemediğini göremiyordu (her satırın `erp_push_error` alanı vardı ama
 * UI'ya servis edilmiyordu).
 */
erpPushRouter.get(
  '/erp/connections/:id/push-failures',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [conn] = await db
        .select({ id: erpConnections.id, tenant_id: erpConnections.tenant_id })
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.id ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');
      if (!conn.tenant_id) {
        res.json({ data: [], count: 0 });
        return;
      }

      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const failures = await db
        .select({
          id: payableItems.id,
          title: payableItems.title,
          invoice_number: payableItems.invoice_number,
          supplier_name: payableItems.supplier_name,
          amount: payableItems.amount,
          issue_date: payableItems.issue_date,
          erp_push_status: payableItems.erp_push_status,
          erp_push_error: payableItems.erp_push_error,
          erp_pushed_at: payableItems.erp_pushed_at,
          updated_at: payableItems.updated_at,
        })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.tenant_id, conn.tenant_id),
            eq(payableItems.is_active, true),
            eq(payableItems.erp_push_status, 'failed'),
          ),
        )
        .orderBy(desc(payableItems.updated_at))
        .limit(limit);

      res.json({ data: failures, count: failures.length, limit });
    } catch (err) {
      next(err);
    }
  },
);
