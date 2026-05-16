/**
 * /v1/payroll — Aylık maaş bordrosu.
 *
 *   GET  /v1/payroll/runs              → tüm aylık bordrolar
 *   POST /v1/payroll/runs              → yeni bordro (period verince tüm aktif personel için hesaplar)
 *   GET  /v1/payroll/runs/:id          → run + items
 *   POST /v1/payroll/runs/:id/approve  → onayla
 *   POST /v1/payroll/runs/:id/mark-paid → ödendi işle
 *   DELETE /v1/payroll/runs/:id        → draft ise sil
 *   GET  /v1/payroll/summary           → toplam personel + son ay özet
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  employees,
  getDb,
  payrollItems,
  payrollRuns,
} from '@sayman/db';
import { calculatePayroll } from '../lib/payroll-calc';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant, requireTenantOrAggregate, tenantScope } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

export const payrollRouter = Router();

payrollRouter.get('/payroll/runs', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const where = tenantScope(req, payrollRuns.tenant_id);
    const rows = await db
      .select()
      .from(payrollRuns)
      .where(where)
      .orderBy(desc(payrollRuns.period))
      .limit(LIST_LIMITS.small);
    const total = await countTotal(payrollRuns, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.small) });
  } catch (err) {
    next(err);
  }
});

const createRunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM formatında olmalı'),
});

payrollRouter.post('/payroll/runs', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createRunSchema.parse(req.body);
    const db = getDb();

    // Tüm aktif personel
    const activeEmployees = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenant_id, req.activeTenantId!),
          eq(employees.is_active, true),
          eq(employees.status, 'active'),
        ),
      );

    if (activeEmployees.length === 0) {
      throw new HttpError(400, 'Aktif personel yok');
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalSgk = 0;
    let totalTax = 0;
    let totalEmployerCost = 0;

    // Tek transaction: run + items + totals atomik
    const { run, updated } = await db.transaction(async (trx) => {
      let r;
      try {
        [r] = await trx
          .insert(payrollRuns)
          .values({
            tenant_id: req.activeTenantId!,
            period: body.period,
            status: 'draft',
            employee_count: String(activeEmployees.length),
            created_by: req.authUser?.id ?? null,
          })
          .returning();
      } catch (err) {
        if ((err as Error).message.includes('uq_payroll_runs')) {
          throw new HttpError(409, `${body.period} dönemi için zaten bordro var`);
        }
        throw err;
      }
      if (!r) throw new HttpError(500, 'Run oluşturulamadı');

      // Tek batch insert (N round-trip yerine 1)
      const itemValues = activeEmployees.map((emp) => {
        const calc = calculatePayroll({
          gross_monthly: Number(emp.gross_salary),
          marital_status: emp.marital_status,
          kids_count: Number(emp.kids_count),
          spouse_working: emp.spouse_working,
        });

        totalGross += calc.gross;
        totalNet += calc.net;
        totalSgk +=
          calc.sgk_employee + calc.unemployment_employee + calc.sgk_employer + calc.unemployment_employer;
        totalTax += calc.income_tax + calc.stamp_tax;
        totalEmployerCost += calc.total_employer_cost;

        return {
          run_id: r.id,
          employee_id: emp.id,
          gross: String(calc.gross),
          sgk_employee: String(calc.sgk_employee),
          unemployment_employee: String(calc.unemployment_employee),
          income_tax: String(calc.income_tax),
          stamp_tax: String(calc.stamp_tax),
          agi: String(calc.agi),
          net: String(calc.net),
          sgk_employer: String(calc.sgk_employer),
          unemployment_employer: String(calc.unemployment_employer),
          total_employer_cost: String(calc.total_employer_cost),
          breakdown: calc.breakdown,
        };
      });

      await trx.insert(payrollItems).values(itemValues);

      const [u] = await trx
        .update(payrollRuns)
        .set({
          total_gross: String(totalGross.toFixed(2)),
          total_net: String(totalNet.toFixed(2)),
          total_sgk: String(totalSgk.toFixed(2)),
          total_tax: String(totalTax.toFixed(2)),
          total_employer_cost: String(totalEmployerCost.toFixed(2)),
        })
        .where(eq(payrollRuns.id, r.id))
        .returning();

      return { run: r, updated: u };
    });

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'payroll.run.create',
      target_type: 'payroll_runs',
      target_id: run.id,
      details: {
        period: body.period,
        employee_count: activeEmployees.length,
        total_gross: totalGross,
      },
    });

    res.status(201).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

payrollRouter.get('/payroll/runs/:id', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [run] = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.id, String(req.params.id ?? '')),
          tenantScope(req, payrollRuns.tenant_id),
        ),
      );
    if (!run) throw new HttpError(404, 'Bordro bulunamadı');

    const items = await db
      .select({
        id: payrollItems.id,
        employee_id: payrollItems.employee_id,
        employee_name: employees.full_name,
        employee_position: employees.position,
        gross: payrollItems.gross,
        sgk_employee: payrollItems.sgk_employee,
        unemployment_employee: payrollItems.unemployment_employee,
        income_tax: payrollItems.income_tax,
        stamp_tax: payrollItems.stamp_tax,
        agi: payrollItems.agi,
        net: payrollItems.net,
        sgk_employer: payrollItems.sgk_employer,
        unemployment_employer: payrollItems.unemployment_employer,
        total_employer_cost: payrollItems.total_employer_cost,
        breakdown: payrollItems.breakdown,
      })
      .from(payrollItems)
      .leftJoin(employees, eq(employees.id, payrollItems.employee_id))
      .where(eq(payrollItems.run_id, run.id));

    res.json({ data: { ...run, items } });
  } catch (err) {
    next(err);
  }
});

payrollRouter.post(
  '/payroll/runs/:id/approve',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin', 'yonetici'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Bordro onaylama yetkisi yok');
      }
      const db = getDb();
      const [row] = await db
        .update(payrollRuns)
        .set({
          status: 'approved',
          approved_by: req.authUser?.id ?? null,
          approved_at: new Date(),
          updated_at: new Date(),
        })
        .where(
          and(
            eq(payrollRuns.id, String(req.params.id ?? '')),
            eq(payrollRuns.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Bordro bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.post(
  '/payroll/runs/:id/mark-paid',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(payrollRuns)
        .set({ status: 'paid', paid_at: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(payrollRuns.id, String(req.params.id ?? '')),
            eq(payrollRuns.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Bordro bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

payrollRouter.delete('/payroll/runs/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const runId = String(req.params.id ?? '');

    await db.transaction(async (trx) => {
      const [existing] = await trx
        .select({ status: payrollRuns.status })
        .from(payrollRuns)
        .where(
          and(eq(payrollRuns.id, runId), eq(payrollRuns.tenant_id, req.activeTenantId!)),
        );
      if (!existing) throw new HttpError(404, 'Bordro bulunamadı');
      if (existing.status !== 'draft') {
        throw new HttpError(400, 'Sadece taslak (draft) bordrolar silinebilir');
      }
      await trx
        .delete(payrollRuns)
        .where(
          and(eq(payrollRuns.id, runId), eq(payrollRuns.tenant_id, req.activeTenantId!)),
        );
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

payrollRouter.get('/payroll/summary', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const [employeeStats] = await db
      .select({
        active_count: sql<string>`COUNT(*) FILTER (WHERE status = 'active')`,
        total_gross: sql<string>`COALESCE(SUM(gross_salary::numeric) FILTER (WHERE status = 'active'), 0)`,
      })
      .from(employees)
      .where(and(tenantScope(req, employees.tenant_id), eq(employees.is_active, true)));

    const [lastRun] = await db
      .select()
      .from(payrollRuns)
      .where(tenantScope(req, payrollRuns.tenant_id))
      .orderBy(desc(payrollRuns.period))
      .limit(1);

    res.json({
      data: {
        active_employees: Number(employeeStats?.active_count ?? 0),
        monthly_gross_total: Number(employeeStats?.total_gross ?? 0),
        last_run: lastRun ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});
