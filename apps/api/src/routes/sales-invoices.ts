/**
 * /v1/sales-invoices — Satış faturaları (alacak/gelir tarafı).
 *
 *   GET    /v1/sales-invoices                   → liste
 *   POST   /v1/sales-invoices                   → yeni satış faturası
 *   GET    /v1/sales-invoices/:id               → tek detay
 *   PATCH  /v1/sales-invoices/:id               → güncelle
 *   DELETE /v1/sales-invoices/:id               → soft delete
 *   POST   /v1/sales-invoices/:id/push/:connId  → ERP'ye push
 *   GET    /v1/sales-invoices/summary           → toplam alacak + geciken + bu ay tahsil
 */
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  erpConnections,
  getDb,
  salesInvoices,
} from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { getAdapter } from '../lib/erp';
import { decryptSecret } from '../lib/secret-box';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const salesInvoicesRouter = Router();

const createSchema = z.object({
  title: z.string().min(2).max(255),
  customer_name: z.string().max(255).optional().nullable(),
  customer_company_id: z.string().uuid().optional().nullable(),
  customer_person_id: z.string().uuid().optional().nullable(),
  customer_type: z.enum(['company', 'person']).default('company'),
  invoice_number: z.string().max(120).optional().nullable(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  issue_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
});

salesInvoicesRouter.get('/sales-invoices', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.tenant_id, req.activeTenantId!),
          eq(salesInvoices.is_active, true),
        ),
      )
      .orderBy(desc(salesInvoices.due_date), desc(salesInvoices.created_at))
      .limit(500);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

salesInvoicesRouter.get(
  '/sales-invoices/summary',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [r] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${salesInvoices.amount}::numeric), 0)`,
          paid: sql<string>`COALESCE(SUM(${salesInvoices.paid_amount}::numeric), 0)`,
          outstanding: sql<string>`COALESCE(SUM(${salesInvoices.amount}::numeric - ${salesInvoices.paid_amount}::numeric), 0)`,
          overdue_count: sql<string>`COUNT(*) FILTER (WHERE ${salesInvoices.due_date} < ${today} AND ${salesInvoices.status} NOT IN ('paid', 'cancelled'))`,
          overdue_amount: sql<string>`COALESCE(SUM(${salesInvoices.amount}::numeric - ${salesInvoices.paid_amount}::numeric) FILTER (WHERE ${salesInvoices.due_date} < ${today} AND ${salesInvoices.status} NOT IN ('paid', 'cancelled')), 0)`,
          collected_this_month: sql<string>`COALESCE(SUM(${salesInvoices.paid_amount}::numeric) FILTER (WHERE ${salesInvoices.updated_at} >= ${monthStartStr}::timestamp), 0)`,
          invoice_count: sql<string>`COUNT(*)`,
        })
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.tenant_id, req.activeTenantId!),
            eq(salesInvoices.is_active, true),
          ),
        );

      res.json({
        data: {
          total_amount: Number(r?.total ?? 0),
          paid_amount: Number(r?.paid ?? 0),
          outstanding: Number(r?.outstanding ?? 0),
          overdue_count: Number(r?.overdue_count ?? 0),
          overdue_amount: Number(r?.overdue_amount ?? 0),
          collected_this_month: Number(r?.collected_this_month ?? 0),
          invoice_count: Number(r?.invoice_count ?? 0),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

salesInvoicesRouter.post('/sales-invoices', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(salesInvoices)
      .values({
        tenant_id: req.activeTenantId!,
        title: body.title,
        customer_type: body.customer_type,
        customer_company_id: body.customer_company_id ?? null,
        customer_person_id: body.customer_person_id ?? null,
        customer_name: body.customer_name ?? null,
        invoice_number: body.invoice_number ?? null,
        amount: body.amount,
        currency: body.currency,
        issue_date: body.issue_date ?? null,
        due_date: body.due_date ?? null,
        notes: body.notes ?? null,
        subsidiary_id: body.subsidiary_id ?? null,
        created_by: req.authUser?.id ?? null,
        status: 'sent',
      })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

salesInvoicesRouter.get(
  '/sales-invoices/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .select()
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.id, String(req.params.id ?? '')),
            eq(salesInvoices.tenant_id, req.activeTenantId!),
          ),
        );
      if (!row) throw new HttpError(404, 'Satış faturası bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const patchSchema = z.object({
  status: z
    .enum(['draft', 'sent', 'partial_paid', 'paid', 'overdue', 'cancelled'])
    .optional(),
  paid_amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .optional(),
  notes: z.string().optional().nullable(),
});

salesInvoicesRouter.patch(
  '/sales-invoices/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchSchema.parse(req.body);
      const db = getDb();
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.status) patch.status = body.status;
      if (body.paid_amount != null) patch.paid_amount = body.paid_amount;
      if (body.notes !== undefined) patch.notes = body.notes;

      const [row] = await db
        .update(salesInvoices)
        .set(patch)
        .where(
          and(
            eq(salesInvoices.id, String(req.params.id ?? '')),
            eq(salesInvoices.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Satış faturası bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

salesInvoicesRouter.delete(
  '/sales-invoices/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(salesInvoices)
        .set({ is_active: false, updated_at: new Date() })
        .where(
          and(
            eq(salesInvoices.id, String(req.params.id ?? '')),
            eq(salesInvoices.tenant_id, req.activeTenantId!),
          ),
        )
        .returning({ id: salesInvoices.id });
      if (!row) throw new HttpError(404, 'Satış faturası bulunamadı');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

salesInvoicesRouter.post(
  '/sales-invoices/:id/push/:connId',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [conn] = await db
        .select()
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.connId ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'ERP bağlantısı bulunamadı');
      const adapter = getAdapter(conn.provider);
      if (!adapter?.pushSalesInvoice) {
        throw new HttpError(501, `${conn.provider} satış faturası push desteklemiyor`);
      }

      const [s] = await db
        .select()
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.id, String(req.params.id ?? '')),
            eq(salesInvoices.tenant_id, req.activeTenantId!),
          ),
        );
      if (!s) throw new HttpError(404, 'Satış faturası bulunamadı');

      const config = JSON.parse(decryptSecret(conn.config_encrypted));
      try {
        const result = await adapter.pushSalesInvoice(
          config,
          {
            sales_invoice_id: s.id,
            customer_name: s.customer_name,
            cari_external_id: null,
            title: s.title,
            invoice_number: s.invoice_number,
            amount: Number(s.amount),
            currency: s.currency,
            issue_date: s.issue_date,
            due_date: s.due_date,
            notes: s.notes,
          },
          { tenantId: req.activeTenantId!, connectionId: conn.id },
        );

        await db
          .update(salesInvoices)
          .set({
            erp_connection_id: conn.id,
            erp_external_id: result.external_id,
            erp_push_status: 'pushed',
            erp_pushed_at: new Date(),
            erp_push_error: null,
          })
          .where(eq(salesInvoices.id, s.id));

        await auditFromRequest(req, {
          organization_id: req.activeOrgId!,
          actor_user_id: req.authUser?.id,
          actor_email: req.authUser?.email,
          action: 'erp.push.sales_invoice',
          target_type: 'sales_invoices',
          target_id: s.id,
          details: { connection_id: conn.id, external_id: result.external_id },
        });

        res.json({
          data: {
            external_id: result.external_id,
            external_url: result.external_url,
            push_status: 'pushed',
          },
        });
      } catch (err) {
        const errMsg = (err as Error).message;
        await db
          .update(salesInvoices)
          .set({
            erp_connection_id: conn.id,
            erp_push_status: 'failed',
            erp_push_error: errMsg.slice(0, 500),
          })
          .where(eq(salesInvoices.id, s.id));
        throw new HttpError(502, errMsg);
      }
    } catch (err) {
      next(err);
    }
  },
);
