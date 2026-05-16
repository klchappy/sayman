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
import { and, desc, eq, getTableColumns, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  erpConnections,
  getDb,
  salesInvoices,
  tenants,
} from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { auditFromRequest } from '../lib/audit';
import { generateText } from '../lib/ai-providers';
import { getAdapter } from '../lib/erp';
import { decryptSecret } from '../lib/secret-box';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope as tenantScopeHelper } from '../lib/helpers';
import { consumeRateLimit } from '../lib/rate-limit';
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

salesInvoicesRouter.get(
  '/sales-invoices',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const includeReview = req.query.include_review === '1' || req.query.include_review === 'true';
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const cursor = req.query.cursor ? String(req.query.cursor) : null;

      const tenantScope = req.aggregateTenantIds
        ? inArray(salesInvoices.tenant_id, req.aggregateTenantIds)
        : eq(salesInvoices.tenant_id, req.activeTenantId!);
      const conditions = [tenantScope, eq(salesInvoices.is_active, true)];
      if (!includeReview) conditions.push(eq(salesInvoices.needs_review, false));
      if (cursor) {
        conditions.push(sql`${salesInvoices.created_at} < ${cursor}::timestamptz`);
      }

      const rows = await db
        .select({
          ...getTableColumns(salesInvoices),
          tenant_name: tenants.name,
        })
        .from(salesInvoices)
        .leftJoin(tenants, eq(tenants.id, salesInvoices.tenant_id))
        .where(and(...conditions))
        .orderBy(desc(salesInvoices.due_date), desc(salesInvoices.created_at))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.created_at : null;

      res.json({
        data,
        has_more: hasMore,
        next_cursor: nextCursor,
        aggregate: req.aggregateTenantIds ? { tenant_count: req.aggregateTenantIds.length } : null,
      });
    } catch (err) {
      next(err);
    }
  },
);

salesInvoicesRouter.get(
  '/sales-invoices/summary',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      // List ile aynı filtre: default'ta needs_review=true kayıtları sayma
      const includeReview = req.query.include_review === '1' || req.query.include_review === 'true';
      const conditions = [
        tenantScopeHelper(req, salesInvoices.tenant_id),
        eq(salesInvoices.is_active, true),
      ];
      if (!includeReview) conditions.push(eq(salesInvoices.needs_review, false));

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
        .where(and(...conditions));

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

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'sales_invoice.create',
      target_type: 'sales_invoices',
      target_id: row?.id ?? null,
      details: {
        title: body.title,
        invoice_number: body.invoice_number ?? null,
        amount: body.amount,
        currency: body.currency,
        customer_type: body.customer_type,
      },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

salesInvoicesRouter.get(
  '/sales-invoices/:id',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .select()
        .from(salesInvoices)
        .where(
          and(
            eq(salesInvoices.id, String(req.params.id ?? '')),
            tenantScopeHelper(req, salesInvoices.tenant_id),
            eq(salesInvoices.is_active, true),
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

// Status transition guard: hangi statüden hangi statüye geçilebilir
// draft → sent | cancelled
// sent → partial_paid | paid | overdue | cancelled
// partial_paid → paid | overdue | cancelled
// overdue → partial_paid | paid | cancelled
// paid → (kilitli; geri dönüş yok)
// cancelled → (kilitli)
const SALES_INVOICE_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  draft: ['sent', 'cancelled'],
  sent: ['partial_paid', 'paid', 'overdue', 'cancelled'],
  partial_paid: ['paid', 'overdue', 'cancelled'],
  overdue: ['partial_paid', 'paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

salesInvoicesRouter.patch(
  '/sales-invoices/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchSchema.parse(req.body);
      const db = getDb();
      const id = String(req.params.id ?? '');

      // Status transition validation — kullanıcı yanlış status değişimi yapmasın
      if (body.status) {
        const [current] = await db
          .select({ status: salesInvoices.status })
          .from(salesInvoices)
          .where(
            and(
              eq(salesInvoices.id, id),
              eq(salesInvoices.tenant_id, req.activeTenantId!),
            ),
          );
        if (!current) throw new HttpError(404, 'Satış faturası bulunamadı');
        const allowed = SALES_INVOICE_TRANSITIONS[current.status] ?? [];
        if (current.status !== body.status && !allowed.includes(body.status)) {
          throw new HttpError(
            400,
            `Geçersiz status değişimi: ${current.status} → ${body.status}. İzin verilen: ${allowed.join(', ') || 'yok'}`,
            'INVALID_TRANSITION',
          );
        }
      }

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

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'sales_invoice.update',
        target_type: 'sales_invoices',
        target_id: row?.id ?? String(req.params.id ?? ''),
        details: {
          changed: Object.keys(patch).filter((k) => k !== 'updated_at'),
          patch,
        },
      });

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

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'sales_invoice.delete',
        target_type: 'sales_invoices',
        target_id: row?.id ?? String(req.params.id ?? ''),
        details: { soft_delete: true },
      });

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

        await db.transaction(async (trx) => {
          await trx
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

/**
 * AI tahsilat stratejisi — Claude geciken alacaklıları + ödeme geçmişini analiz eder,
 * öncelik + yaklaşım önerir.
 */
salesInvoicesRouter.post(
  '/sales-invoices/ai-collection-strategy',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      await consumeRateLimit({
        identifier: `collection-ai:${req.authUser!.id}`,
        limit: 10,
        window_seconds: 3600,
      });
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);

      const overdue = await db.execute(sql`
        SELECT id, title, invoice_number, customer_name, amount, paid_amount, due_date,
               (CURRENT_DATE - due_date) AS days_overdue
        FROM sales_invoices
        WHERE tenant_id = ${req.activeTenantId!}::uuid
          AND is_active = true
          AND status NOT IN ('paid', 'cancelled')
          AND due_date < ${today}::date
        ORDER BY due_date ASC
        LIMIT 30
      `);

      const overdueList = ((overdue.rows ?? overdue) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        title: String(r.title),
        invoice_number: r.invoice_number ?? null,
        customer_name: r.customer_name ?? null,
        amount: Number(r.amount),
        paid_amount: Number(r.paid_amount ?? 0),
        outstanding: Number(r.amount) - Number(r.paid_amount ?? 0),
        due_date: String(r.due_date),
        days_overdue: Number(r.days_overdue),
      }));

      if (overdueList.length === 0) {
        res.json({
          data: {
            method: 'no_overdue',
            suggestions: [],
            summary: 'Geciken alacak yok — iyi durumdasın.',
          },
        });
        return;
      }

      function ruleBased() {
        return [...overdueList]
          .sort((a, b) => b.outstanding * b.days_overdue - a.outstanding * a.days_overdue)
          .slice(0, 10)
          .map((inv, idx) => ({
            invoice_id: inv.id,
            customer_name: inv.customer_name,
            outstanding: inv.outstanding,
            days_overdue: inv.days_overdue,
            priority: idx < 3 ? 'high' : idx < 7 ? 'medium' : 'low',
            recommended_channel:
              inv.days_overdue > 30 ? 'phone' : inv.days_overdue > 14 ? 'whatsapp' : 'email',
            reasoning: `${inv.days_overdue} gün gecikme + ${inv.outstanding.toLocaleString('tr-TR')} TL.`,
          }));
      }

      // AI key yapılandırılmamışsa generateText 503 throw eder → catch fallback'e düşer.
      try {
        const r = await generateText(
          {
            system:
              'Sen Sayman tahsilat danismanisin. Geciken faturalari incele. Hangi alacaklilari ONCE ' +
              'takip etmeli, hangi kanali kullanmali? Yanit SADECE JSON: {"summary":"<2-3 cumle>",' +
              '"suggestions":[{"invoice_id":"<id>","priority":"high|medium|low",' +
              '"recommended_channel":"phone|whatsapp|email|legal","reasoning":"<1-2 cumle Turkce>"}]}',
            prompt: `Geciken faturalar: ${JSON.stringify(overdueList.slice(0, 20), null, 2)}\n\nStratejik oncelik listesi ver.`,
            maxTokens: 2000,
            timeoutMs: 45_000,
          },
          {
            organizationId: req.activeOrgId ?? undefined,
            tenantId: req.activeTenantId ?? undefined,
          },
        );
        const text = r.text.trim();
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) {
          res.json({
            data: { method: 'rule_based', suggestions: ruleBased(), summary: `${overdueList.length} geciken fatura.` },
          });
          return;
        }
        const parsed = JSON.parse(m[0]) as {
          summary?: string;
          suggestions: Array<{
            invoice_id: string;
            priority: string;
            recommended_channel: string;
            reasoning: string;
          }>;
        };
        const invMap = new Map(overdueList.map((i) => [i.id, i]));
        const enriched = (parsed.suggestions ?? [])
          .filter((s) => invMap.has(s.invoice_id))
          .map((s) => {
            const inv = invMap.get(s.invoice_id)!;
            return {
              invoice_id: s.invoice_id,
              customer_name: inv.customer_name,
              outstanding: inv.outstanding,
              days_overdue: inv.days_overdue,
              priority: s.priority,
              recommended_channel: s.recommended_channel,
              reasoning: s.reasoning,
            };
          });
        res.json({
          data: { method: 'claude', summary: parsed.summary ?? '', suggestions: enriched },
        });
      } catch (err) {
        logger.error({ err }, 'AI collection strategy crashed');
        res.json({
          data: { method: 'rule_based', suggestions: ruleBased(), summary: `${overdueList.length} geciken fatura.` },
        });
      }
    } catch (err) {
      next(err);
    }
  },
);
