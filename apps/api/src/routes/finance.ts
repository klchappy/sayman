/**
 * /v1/payables + /v1/payments — Fatura ve Ödeme CRUD.
 *
 * Tenant-scoped: tüm liste/CRUD aktif tenant'a filtrelenir.
 * Şahıs/Şirket FK'leri public schema'da (share_scope'lu), ama burası
 * tenant-private tablo.
 */
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  companies,
  getDb,
  payableItems,
  paymentTransactions,
  type PayableItem,
} from '@sayman/db';
import {
  payableStatusSchema,
  paymentMethodSchema,
  ownerTypeSchema,
  suggestCategory,
  transactionStatusSchema,
} from '@sayman/shared';
import { requireAuth } from '../middleware/auth';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { restoreHandler } from '../lib/restore';
import { APPROVAL_THRESHOLD_TRY } from './payment-approvals';

// --- /v1/payables -----------------------------------------------------------

const createPayableSchema = z.object({
  owner_type: ownerTypeSchema.default('company'),
  company_id: z.string().uuid().optional().nullable(),
  person_id: z.string().uuid().optional().nullable(),
  subsidiary_id: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(255),
  category: z.string().max(64).optional().nullable(),
  institution_id: z.string().uuid().optional().nullable(),
  supplier_name: z.string().max(255).optional().nullable(),
  invoice_number: z.string().max(128).optional().nullable(),
  subscription_reference: z.string().max(128).optional().nullable(),
  period_label: z.string().max(32).optional().nullable(),
  issue_date: z.string().date().optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  auto_payment_date: z.string().date().optional().nullable(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Tutar geçersiz'),
  currency: z.string().length(3).default('TRY'),
  status: payableStatusSchema.default('pending'),
  expected_method: paymentMethodSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  needs_review: z.boolean().optional(),
  auto_created_source: z.string().max(64).optional().nullable(),
});

const updatePayableSchema = createPayableSchema
  .omit({ needs_review: true, auto_created_source: true })
  .partial();

// Payables status transition state machine
// draft → pending | approaching | cancelled
// pending → approaching | overdue | partial_paid | paid | cancelled
// approaching → overdue | partial_paid | paid | cancelled
// overdue → partial_paid | paid | cancelled
// partial_paid → paid | overdue | cancelled
// paid → (kilitli; geri dönüş yok)
// cancelled → (kilitli)
// archived/needs_review/waiting_approval transition'ları otomatik (kullanıcı zorlamaz)
const PAYABLE_STATUS_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  draft: ['pending', 'approaching', 'cancelled'],
  pending: ['approaching', 'overdue', 'partial_paid', 'paid', 'cancelled'],
  approaching: ['overdue', 'partial_paid', 'paid', 'cancelled', 'pending'],
  overdue: ['partial_paid', 'paid', 'cancelled', 'pending'],
  partial_paid: ['paid', 'overdue', 'cancelled'],
  paid: [],
  cancelled: [],
  archived: [],
  needs_review: ['pending', 'draft', 'cancelled'],
  waiting_approval: ['paid', 'pending', 'cancelled'],
};

export const payablesRouter = Router();

payablesRouter.get(
  '/payables',
  requireAuth,
  requireTenantOrAggregate,
  async (req, res, next) => {
    try {
      const db = getDb();
      // Default: sadece onaylanmış faturalar. Review-pending kayıtlar
      // /review-queue'da görünür; ana finansal listeye onaydan sonra düşer.
      const includeReview =
        req.query.include_review === '1' || req.query.include_review === 'true';
      const onlyApproved =
        req.query.only_approved === '1' || req.query.only_approved === 'true';
      const applyApprovedFilter = onlyApproved || !includeReview;

      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      // Cursor: önceki sayfanın son satırının created_at ISO timestamp'i
      const cursor = req.query.cursor ? String(req.query.cursor) : null;

      const baseConditions = [
        tenantScope(req, payableItems.tenant_id),
        eq(payableItems.is_active, true),
      ];
      if (applyApprovedFilter) {
        baseConditions.push(eq(payableItems.needs_review, false));
      }
      const conditions = [...baseConditions];
      if (cursor) {
        // created_at < cursor — bir önceki sayfa devamı
        conditions.push(sql`${payableItems.created_at} < ${cursor}::timestamptz`);
      }

      const rows = await db
        .select()
        .from(payableItems)
        .where(and(...conditions))
        .orderBy(desc(payableItems.due_date), desc(payableItems.created_at))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.created_at : null;
      const total = await countTotal(payableItems, and(...baseConditions));

      res.json({
        data,
        ...listMeta(data, total, limit),
        has_more: hasMore,
        next_cursor: nextCursor,
        aggregate: req.aggregateTenantIds ? { tenant_count: req.aggregateTenantIds.length } : null,
      });
    } catch (err) {
      next(err);
    }
  },
);

payablesRouter.post('/payables', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createPayableSchema.parse(req.body);
    const db = getDb();

    // Auto-match: company_id yoksa supplier_name veya title üzerinden şirkete eşle
    let companyId = body.company_id ?? null;
    if (!companyId && (body.supplier_name || body.title)) {
      const lookupName = body.supplier_name ?? body.title;
      const [match] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.organization_id, req.activeOrgId!),
            eq(companies.is_active, true),
            or(ilike(companies.name, lookupName), ilike(companies.short_name, lookupName)),
          ),
        )
        .limit(1);
      if (match) companyId = match.id;
    }

    // Auto-categorize: category yoksa title/supplier'dan öner
    let category = body.category ?? null;
    if (!category) {
      const suggestion = suggestCategory(body.title, body.supplier_name, body.notes);
      if (suggestion && suggestion.confidence >= 0.3) {
        category = suggestion.category;
      }
    }

    const [row] = await db
      .insert(payableItems)
      .values({
        tenant_id: req.activeTenantId!,
        owner_type: body.owner_type,
        company_id: companyId,
        person_id: body.person_id ?? null,
        title: body.title,
        category,
        institution_id: body.institution_id ?? null,
        supplier_name: body.supplier_name ?? null,
        invoice_number: body.invoice_number ?? null,
        subscription_reference: body.subscription_reference ?? null,
        period_label: body.period_label ?? null,
        issue_date: body.issue_date ?? null,
        due_date: body.due_date ?? null,
        auto_payment_date: body.auto_payment_date ?? null,
        amount: body.amount,
        currency: body.currency,
        status: body.status,
        expected_method: body.expected_method ?? null,
        notes: body.notes ?? null,
        needs_review: body.needs_review ?? false,
        auto_created_source: body.auto_created_source ?? null,
        created_by: req.authUserId,
      })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

payablesRouter.get('/payables/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(payableItems)
      .where(
        and(
          eq(payableItems.id, String(req.params.id ?? '')),
          tenantScope(req, payableItems.tenant_id),
        ),
      );
    if (!row) throw new HttpError(404, 'Fatura bulunamadı');

    const tx = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.payable_id, row.id))
      .orderBy(desc(paymentTransactions.paid_at));
    res.json({ data: { ...row, transactions: tx } });
  } catch (err) {
    next(err);
  }
});

payablesRouter.patch('/payables/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updatePayableSchema.parse(req.body);
    const db = getDb();

    // Required field null protection: title ve amount silinmesin (PATCH ile)
    if (body.title === null) {
      throw new HttpError(400, 'Başlık boş bırakılamaz', 'INVALID_FIELD');
    }
    if (body.amount === null) {
      throw new HttpError(400, 'Tutar boş bırakılamaz', 'INVALID_FIELD');
    }

    // Status transition kontrolü
    let currentStatus: string | null = null;
    if (body.status) {
      const [existing] = await db
        .select({ status: payableItems.status })
        .from(payableItems)
        .where(
          and(
            eq(payableItems.id, String(req.params.id ?? '')),
            eq(payableItems.tenant_id, req.activeTenantId!),
            eq(payableItems.is_active, true),
          ),
        );
      if (!existing) throw new HttpError(404, 'Fatura bulunamadı');
      currentStatus = existing.status;
      const allowed = PAYABLE_STATUS_TRANSITIONS[currentStatus] ?? [];
      if (currentStatus !== body.status && !allowed.includes(body.status)) {
        throw new HttpError(
          400,
          `Status geçişi geçersiz: ${currentStatus} → ${body.status}`,
          'INVALID_STATUS_TRANSITION',
        );
      }
    }

    const [row] = await db
      .update(payableItems)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(payableItems.id, String(req.params.id ?? '')),
          eq(payableItems.tenant_id, req.activeTenantId!),
          eq(payableItems.is_active, true),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Fatura bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

payablesRouter.delete('/payables/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(payableItems)
      .set({ is_active: false, status: 'cancelled', updated_at: new Date() })
      .where(
        and(
          eq(payableItems.id, String(req.params.id ?? '')),
          eq(payableItems.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Fatura bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// Restore — soft-deleted fatura geri al
payablesRouter.post(
  '/payables/:id/restore',
  requireAuth,
  requireTenant,
  restoreHandler({ table: payableItems, entity: 'payable', resetStatus: 'pending', scope: 'tenant' }),
);

// --- /v1/payments -----------------------------------------------------------

const createPaymentSchema = z.object({
  payable_id: z.string().uuid(),
  paid_at: z.string().date(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  method: paymentMethodSchema,
  bank_short_code: z.string().max(32).optional().nullable(),
  receipt_url: z.string().url().optional().nullable(),
  reference_no: z.string().max(128).optional().nullable(),
  status: transactionStatusSchema.default('approved'),
  notes: z.string().optional().nullable(),
});

export const paymentsRouter = Router();

paymentsRouter.get('/payments', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const where = and(
      tenantScope(req, paymentTransactions.tenant_id),
      eq(paymentTransactions.is_active, true),
    );
    const rows = await db
      .select()
      .from(paymentTransactions)
      .where(where)
      .orderBy(desc(paymentTransactions.paid_at))
      .limit(LIST_LIMITS.medium);
    const total = await countTotal(paymentTransactions, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.medium) });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post('/payments', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    const db = getDb();

    // Yüksek tutarlı ödeme: APPROVAL_THRESHOLD_TRY ≥ 50.000 TRY → direkt ödeme
    // yapılamaz, payment_approvals üzerinden gitmek zorunlu (segregation of
    // duties + audit). Frontend bypass edilirse backend reddet.
    const amountNum = Number(body.amount);
    if (Number.isFinite(amountNum) && amountNum >= APPROVAL_THRESHOLD_TRY) {
      throw new HttpError(
        403,
        `${APPROVAL_THRESHOLD_TRY.toLocaleString('tr-TR')} TRY üzeri ödemeler için onay süreci gerekli — Ödeme Onayları'ndan öneri oluştur`,
        'APPROVAL_REQUIRED',
      );
    }

    const tx = await db.transaction(async (trx) => {
      // SELECT FOR UPDATE — concurrent payment'larda lost update'i engelle.
      // Plain SELECT (transaction içinde bile) snapshot okur; FOR UPDATE
      // row-level lock alır, paralel transaction commit bekler ve güncel
      // paid_amount'u görür.
      const lockResult = await trx.execute(sql`
        SELECT id, amount, paid_amount, status
        FROM payable_items
        WHERE id = ${body.payable_id}::uuid
          AND tenant_id = ${req.activeTenantId!}::uuid
        FOR UPDATE
      `);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payable = ((lockResult as any).rows ?? (lockResult as any))[0];
      if (!payable) throw new HttpError(404, 'Fatura bulunamadı (bu tenant\'ta)');

      const [inserted] = await trx
        .insert(paymentTransactions)
        .values({
          tenant_id: req.activeTenantId!,
          payable_id: body.payable_id,
          paid_at: body.paid_at,
          amount: body.amount,
          method: body.method,
          bank_short_code: body.bank_short_code ?? null,
          receipt_url: body.receipt_url ?? null,
          reference_no: body.reference_no ?? null,
          status: body.status,
          notes: body.notes ?? null,
          created_by: req.authUserId,
          approved_by: body.status === 'approved' ? req.authUserId : null,
          approved_at: body.status === 'approved' ? new Date() : null,
        })
        .returning();

      const newPaid = Number(payable.paid_amount) + Number(body.amount);
      const total = Number(payable.amount);
      let newStatus = payable.status;
      if (newPaid >= total) newStatus = 'paid';
      else if (newPaid > 0) newStatus = 'partial_paid';

      await trx
        .update(payableItems)
        .set({
          paid_amount: newPaid.toFixed(2),
          status: newStatus,
          updated_at: new Date(),
        })
        .where(eq(payableItems.id, payable.id));

      return inserted;
    });

    res.status(201).json({ data: tx });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.delete('/payments/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(paymentTransactions)
      .set({ is_active: false, status: 'cancelled', updated_at: new Date() })
      .where(
        and(
          eq(paymentTransactions.id, String(req.params.id ?? '')),
          eq(paymentTransactions.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Ödeme bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
