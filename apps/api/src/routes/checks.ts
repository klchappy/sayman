/**
 * /v1/checks — Çek ve senet (bono) takibi.
 *
 *   GET    /v1/checks                      → liste (filter: direction, status, due_in_days)
 *   POST   /v1/checks                      → yeni çek/senet
 *   GET    /v1/checks/:id                  → tek detay
 *   PATCH  /v1/checks/:id                  → durum / tarih güncelle
 *   POST   /v1/checks/:id/deposit          → banka'ya yatırıldı işle (incoming)
 *   POST   /v1/checks/:id/cash             → tahsil edildi işle
 *   POST   /v1/checks/:id/return           → karşılıksız döndü (reason zorunlu)
 *   GET    /v1/checks/summary              → portföy + bu ay vade dolan + risk
 */
import { and, asc, desc, eq, getTableColumns, gte, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { checksAndNotes, getDb, tenants } from '@sayman/db';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { restoreHandler } from '../lib/restore';
import { requireAuth } from '../middleware/auth';

export const checksRouter = Router();

checksRouter.get('/checks/summary', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().slice(0, 10);

    const [s] = await db
      .select({
        portfolio_count: sql<string>`COUNT(*) FILTER (WHERE direction = 'incoming' AND status = 'portfolio')`,
        portfolio_amount: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE direction = 'incoming' AND status = 'portfolio'), 0)`,
        deposited_count: sql<string>`COUNT(*) FILTER (WHERE direction = 'incoming' AND status = 'deposited')`,
        deposited_amount: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE direction = 'incoming' AND status = 'deposited'), 0)`,
        outgoing_pending_count: sql<string>`COUNT(*) FILTER (WHERE direction = 'outgoing' AND status = 'issued')`,
        outgoing_pending_amount: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE direction = 'outgoing' AND status = 'issued'), 0)`,
        due_30d_count: sql<string>`COUNT(*) FILTER (WHERE due_date BETWEEN ${today} AND ${in30Str} AND status IN ('portfolio', 'deposited', 'issued'))`,
        due_30d_amount: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE due_date BETWEEN ${today} AND ${in30Str} AND status IN ('portfolio', 'deposited', 'issued')), 0)`,
        returned_count: sql<string>`COUNT(*) FILTER (WHERE status = 'returned')`,
        returned_amount: sql<string>`COALESCE(SUM(amount::numeric) FILTER (WHERE status = 'returned'), 0)`,
      })
      .from(checksAndNotes)
      .where(
        and(tenantScope(req, checksAndNotes.tenant_id), eq(checksAndNotes.is_active, true)),
      );

    res.json({
      data: {
        portfolio: {
          count: Number(s?.portfolio_count ?? 0),
          amount: Number(s?.portfolio_amount ?? 0),
        },
        deposited: {
          count: Number(s?.deposited_count ?? 0),
          amount: Number(s?.deposited_amount ?? 0),
        },
        outgoing_pending: {
          count: Number(s?.outgoing_pending_count ?? 0),
          amount: Number(s?.outgoing_pending_amount ?? 0),
        },
        due_next_30d: {
          count: Number(s?.due_30d_count ?? 0),
          amount: Number(s?.due_30d_amount ?? 0),
        },
        returned: {
          count: Number(s?.returned_count ?? 0),
          amount: Number(s?.returned_amount ?? 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

checksRouter.get('/checks', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [
      tenantScope(req, checksAndNotes.tenant_id),
      eq(checksAndNotes.is_active, true),
    ];
    if (req.query.direction) {
      conditions.push(eq(checksAndNotes.direction, String(req.query.direction)));
    }
    if (req.query.status) {
      conditions.push(eq(checksAndNotes.status, String(req.query.status)));
    }
    if (req.query.kind) {
      conditions.push(eq(checksAndNotes.kind, String(req.query.kind)));
    }
    if (req.query.due_in_days) {
      const days = Math.min(365, Number(req.query.due_in_days));
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date();
      future.setDate(future.getDate() + days);
      conditions.push(gte(checksAndNotes.due_date, today));
      conditions.push(lte(checksAndNotes.due_date, future.toISOString().slice(0, 10)));
    }

    const where = and(...conditions);
    const rows = await db
      .select({
        ...getTableColumns(checksAndNotes),
        tenant_name: tenants.name,
      })
      .from(checksAndNotes)
      .leftJoin(tenants, eq(tenants.id, checksAndNotes.tenant_id))
      .where(where)
      .orderBy(asc(checksAndNotes.due_date), desc(checksAndNotes.created_at))
      .limit(LIST_LIMITS.large);
    const total = await countTotal(checksAndNotes, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.large) });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  kind: z.enum(['check', 'promissory_note']).default('check'),
  direction: z.enum(['incoming', 'outgoing']),
  document_no: z.string().max(80).optional().nullable(),
  drawer_name: z.string().max(255).optional().nullable(),
  beneficiary_name: z.string().max(255).optional().nullable(),
  bank_id: z.string().uuid().optional().nullable(),
  bank_branch: z.string().max(120).optional().nullable(),
  bank_account_no: z.string().max(50).optional().nullable(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  currency: z.string().length(3).default('TRY'),
  issue_date: z.string().optional().nullable(),
  due_date: z.string().min(8),
  portfolio_no: z.string().max(50).optional().nullable(),
  related_payable_id: z.string().uuid().optional().nullable(),
  related_sales_invoice_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

checksRouter.post('/checks', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    // İlk status: incoming→portfolio, outgoing→issued
    const initialStatus = body.direction === 'incoming' ? 'portfolio' : 'issued';

    const [row] = await db
      .insert(checksAndNotes)
      .values({
        tenant_id: req.activeTenantId!,
        kind: body.kind,
        direction: body.direction,
        status: initialStatus,
        document_no: body.document_no ?? null,
        drawer_name: body.drawer_name ?? null,
        beneficiary_name: body.beneficiary_name ?? null,
        bank_id: body.bank_id ?? null,
        bank_branch: body.bank_branch ?? null,
        bank_account_no: body.bank_account_no ?? null,
        amount: body.amount,
        currency: body.currency,
        issue_date: body.issue_date ?? null,
        due_date: body.due_date,
        portfolio_no: body.portfolio_no ?? null,
        related_payable_id: body.related_payable_id ?? null,
        related_sales_invoice_id: body.related_sales_invoice_id ?? null,
        notes: body.notes ?? null,
        created_by: req.authUser?.id ?? null,
      })
      .returning();

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

checksRouter.get('/checks/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(checksAndNotes)
      .where(
        and(
          eq(checksAndNotes.id, String(req.params.id ?? '')),
          tenantScope(req, checksAndNotes.tenant_id),
          eq(checksAndNotes.is_active, true),
        ),
      );
    if (!row) throw new HttpError(404, 'Çek/Senet bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

checksRouter.delete('/checks/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(checksAndNotes)
      .set({ is_active: false, updated_at: new Date() })
      .where(
        and(
          eq(checksAndNotes.id, String(req.params.id ?? '')),
          eq(checksAndNotes.tenant_id, req.activeTenantId!),
        ),
      )
      .returning({ id: checksAndNotes.id });
    if (!row) throw new HttpError(404, 'Çek/Senet bulunamadı');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Restore — soft-deleted çek/senet geri al
checksRouter.post(
  '/checks/:id/restore',
  requireAuth,
  requireTenant,
  restoreHandler({ table: checksAndNotes, entity: 'check', scope: 'tenant' }),
);

// State transitions

const depositSchema = z.object({
  deposited_at: z.string().optional(),
});

checksRouter.post('/checks/:id/deposit', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = depositSchema.parse(req.body ?? {});
    const db = getDb();
    const [row] = await db
      .update(checksAndNotes)
      .set({
        status: 'deposited',
        deposited_at: body.deposited_at ?? new Date().toISOString().slice(0, 10),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(checksAndNotes.id, String(req.params.id ?? '')),
          eq(checksAndNotes.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Çek bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

const cashSchema = z.object({
  cashed_at: z.string().optional(),
});

checksRouter.post('/checks/:id/cash', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = cashSchema.parse(req.body ?? {});
    const db = getDb();
    const [row] = await db
      .update(checksAndNotes)
      .set({
        status: 'cashed',
        cashed_at: body.cashed_at ?? new Date().toISOString().slice(0, 10),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(checksAndNotes.id, String(req.params.id ?? '')),
          eq(checksAndNotes.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Çek bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

const returnSchema = z.object({
  return_reason: z.string().min(2).max(500),
  returned_at: z.string().optional(),
});

checksRouter.post('/checks/:id/return', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = returnSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(checksAndNotes)
      .set({
        status: 'returned',
        return_reason: body.return_reason,
        returned_at: body.returned_at ?? new Date().toISOString().slice(0, 10),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(checksAndNotes.id, String(req.params.id ?? '')),
          eq(checksAndNotes.tenant_id, req.activeTenantId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Çek bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
