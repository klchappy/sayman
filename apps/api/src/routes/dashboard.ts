/**
 * /v1/dashboard/summary — tek call, KPI aggregation (tenant-scope).
 *
 * Response:
 *   cashflow_6mo:        [{ month, inflow, outflow }]  son 6 ay
 *   payables_summary:    { total, paid, open, overdue_count, approaching_count }
 *   upcoming_payables:   top 5 (T-30 within, status in pending/approaching)
 *   subscriptions:       { active_count, monthly_total, commitment_expiring_60: count }
 *   guarantees:          { active_count, total_amount, expiring_60: count }
 *   official_payments:   { this_month_amount, next_30_count }
 *   regular_payments:    { this_month_amount, next_30_count }
 */
import { and, count, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import {
  getDb,
  guarantees,
  officialPaymentPeriods,
  payableItems,
  paymentTransactions,
  regularPaymentPeriods,
  subscriptions,
  subsidiaries,
} from '@sayman/db';
import { requireAuth } from '../middleware/auth';
import { requireTenantOrAggregate, tenantScope } from '../lib/helpers';

export const dashboardRouter = Router();

function today(): Date {
  return new Date();
}
function plusDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function todayStr(): string {
  return today().toISOString().slice(0, 10);
}
function monthLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

dashboardRouter.get('/dashboard/summary', requireAuth, requireTenantOrAggregate, async (req, res, next) => {
  try {
    const db = getDb();
    const now = today();
    const t30 = plusDays(now, 30);
    const t60 = plusDays(now, 60);

    // 6 ay önce (ilk gün)
    const sixMoBack = startOfMonth(addMonths(now, -5));
    const sixMoBackStr = sixMoBack.toISOString().slice(0, 10);

    // --- 1. CASHFLOW (son 6 ay) ---
    // outflow: payable_items + payment_transactions
    // inflow: regular_payment_periods.status=paid (kira tahsilatı) — basit yaklaşım
    const cashflowRaw = await db
      .select({
        month: sql<string>`to_char(${paymentTransactions.paid_at}, 'YYYY-MM')`,
        sum: sql<string>`SUM(${paymentTransactions.amount})`,
      })
      .from(paymentTransactions)
      .where(
        and(
          tenantScope(req, paymentTransactions.tenant_id),
          gte(paymentTransactions.paid_at, sixMoBackStr),
        ),
      )
      .groupBy(sql`to_char(${paymentTransactions.paid_at}, 'YYYY-MM')`);

    const cashflowMap = new Map<string, number>(
      cashflowRaw.map((r) => [r.month, Number(r.sum)]),
    );

    const cashflow_6mo: Array<{ month: string; outflow: number; inflow: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(now, -i);
      const lbl = monthLabel(d);
      cashflow_6mo.push({
        month: lbl,
        outflow: cashflowMap.get(lbl) ?? 0,
        inflow: 0, // inflow tracking ileride (rent collection)
      });
    }

    // --- 2. PAYABLES SUMMARY ---
    // approaching: Inbox ile aynı logic — due_date 0-7 gün içinde, henüz ödenmemiş.
    // Status alanına bağlanmak yerine türetilmiş hesaplama (status='approaching' otomatik
    // set edilmiyor, bu yüzden status filtresi sayıyı eksik gösterir).
    const today2 = new Date().toISOString().slice(0, 10);
    const in7d = new Date();
    in7d.setDate(in7d.getDate() + 7);
    const in7Str = in7d.toISOString().slice(0, 10);
    const [payRollup] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${payableItems.amount}), 0)`,
        paid: sql<string>`COALESCE(SUM(${payableItems.paid_amount}), 0)`,
        overdue: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.due_date} < ${today2} AND ${payableItems.status} != 'paid' AND ${payableItems.status} != 'cancelled')`,
        approaching: sql<string>`COUNT(*) FILTER (WHERE ${payableItems.due_date} >= ${today2} AND ${payableItems.due_date} <= ${in7Str} AND ${payableItems.status} != 'paid' AND ${payableItems.status} != 'cancelled')`,
      })
      .from(payableItems)
      .where(and(tenantScope(req, payableItems.tenant_id), eq(payableItems.is_active, true)));

    const payables_summary = {
      total: Number(payRollup?.total ?? 0),
      paid: Number(payRollup?.paid ?? 0),
      open: Number(payRollup?.total ?? 0) - Number(payRollup?.paid ?? 0),
      overdue_count: Number(payRollup?.overdue ?? 0),
      approaching_count: Number(payRollup?.approaching ?? 0),
    };

    // --- 3. UPCOMING PAYABLES (top 5, T-30) ---
    const upcoming_payables = await db
      .select({
        id: payableItems.id,
        title: payableItems.title,
        amount: payableItems.amount,
        due_date: payableItems.due_date,
        status: payableItems.status,
      })
      .from(payableItems)
      .where(
        and(
          tenantScope(req, payableItems.tenant_id),
          eq(payableItems.is_active, true),
          sql`${payableItems.status} IN ('pending', 'approaching')`,
          isNotNull(payableItems.due_date),
          lte(payableItems.due_date, t30),
        ),
      )
      .orderBy(payableItems.due_date)
      .limit(5);

    // --- 4. SUBSCRIPTIONS ---
    const [subRollup] = await db
      .select({
        active: sql<string>`COUNT(*) FILTER (WHERE ${subscriptions.status} = 'active' AND ${subscriptions.is_active} = true)`,
        monthly: sql<string>`COALESCE(SUM(${subscriptions.monthly_amount}) FILTER (WHERE ${subscriptions.status} = 'active' AND ${subscriptions.is_active} = true), 0)`,
        expiring: sql<string>`COUNT(*) FILTER (WHERE ${subscriptions.commitment_end_date} BETWEEN ${todayStr()} AND ${t60} AND ${subscriptions.is_active} = true)`,
      })
      .from(subscriptions)
      .where(tenantScope(req, subscriptions.tenant_id));

    const subscriptions_kpi = {
      active_count: Number(subRollup?.active ?? 0),
      monthly_total: Number(subRollup?.monthly ?? 0),
      commitment_expiring_60: Number(subRollup?.expiring ?? 0),
    };

    // --- 5. GUARANTEES ---
    const [gRollup] = await db
      .select({
        active: sql<string>`COUNT(*) FILTER (WHERE ${guarantees.status} = 'active' AND ${guarantees.is_active} = true)`,
        total: sql<string>`COALESCE(SUM(${guarantees.amount}) FILTER (WHERE ${guarantees.status} = 'active' AND ${guarantees.is_active} = true), 0)`,
        expiring: sql<string>`COUNT(*) FILTER (WHERE ${guarantees.expiry_date} BETWEEN ${todayStr()} AND ${t60} AND ${guarantees.is_active} = true)`,
      })
      .from(guarantees)
      .where(tenantScope(req, guarantees.tenant_id));

    const guarantees_kpi = {
      active_count: Number(gRollup?.active ?? 0),
      total_amount: Number(gRollup?.total ?? 0),
      expiring_60: Number(gRollup?.expiring ?? 0),
    };

    // --- 6. OFFICIAL PAYMENTS (this month) ---
    const monthStart = startOfMonth(now).toISOString().slice(0, 10);
    const monthEnd = plusDays(addMonths(startOfMonth(now), 1), -1);

    const [opRollup] = await db
      .select({
        this_month: sql<string>`COALESCE(SUM(${officialPaymentPeriods.amount}) FILTER (WHERE ${officialPaymentPeriods.due_date} BETWEEN ${monthStart} AND ${monthEnd}), 0)`,
        next_30: sql<string>`COUNT(*) FILTER (WHERE ${officialPaymentPeriods.due_date} BETWEEN ${todayStr()} AND ${t30} AND ${officialPaymentPeriods.status} = 'pending')`,
      })
      .from(officialPaymentPeriods)
      .where(tenantScope(req, officialPaymentPeriods.tenant_id));

    const official_payments_kpi = {
      this_month_amount: Number(opRollup?.this_month ?? 0),
      next_30_count: Number(opRollup?.next_30 ?? 0),
    };

    // --- 7. REGULAR PAYMENTS (this month) ---
    const [rpRollup] = await db
      .select({
        this_month: sql<string>`COALESCE(SUM(${regularPaymentPeriods.amount}) FILTER (WHERE ${regularPaymentPeriods.due_date} BETWEEN ${monthStart} AND ${monthEnd}), 0)`,
        next_30: sql<string>`COUNT(*) FILTER (WHERE ${regularPaymentPeriods.due_date} BETWEEN ${todayStr()} AND ${t30} AND ${regularPaymentPeriods.status} = 'pending')`,
      })
      .from(regularPaymentPeriods)
      .where(tenantScope(req, regularPaymentPeriods.tenant_id));

    const regular_payments_kpi = {
      this_month_amount: Number(rpRollup?.this_month ?? 0),
      next_30_count: Number(rpRollup?.next_30 ?? 0),
    };

    // --- 8. SUBSIDIARY BREAKDOWN (top 8) ---
    // payable_items + subscriptions + guarantees toplam tutarı subsidiary'ye göre
    const subsidiaryBreakdownRaw = await db
      .select({
        subsidiary_id: subsidiaries.id,
        subsidiary_name: subsidiaries.name,
        color: subsidiaries.color,
        total_payables: sql<string>`COALESCE(SUM(${payableItems.amount}) FILTER (WHERE ${payableItems.subsidiary_id} = ${subsidiaries.id} AND ${payableItems.is_active} = true), 0)`,
      })
      .from(subsidiaries)
      .leftJoin(payableItems, eq(payableItems.subsidiary_id, subsidiaries.id))
      .where(and(tenantScope(req, subsidiaries.tenant_id), eq(subsidiaries.is_active, true)))
      .groupBy(subsidiaries.id, subsidiaries.name, subsidiaries.color)
      .orderBy(desc(sql`COALESCE(SUM(${payableItems.amount}) FILTER (WHERE ${payableItems.subsidiary_id} = ${subsidiaries.id} AND ${payableItems.is_active} = true), 0)`))
      .limit(8);

    const subsidiary_breakdown = subsidiaryBreakdownRaw.map((r) => ({
      id: r.subsidiary_id,
      name: r.subsidiary_name,
      color: r.color,
      total_payables: Number(r.total_payables),
    }));

    res.json({
      data: {
        cashflow_6mo,
        payables_summary,
        upcoming_payables,
        subscriptions: subscriptions_kpi,
        guarantees: guarantees_kpi,
        official_payments: official_payments_kpi,
        regular_payments: regular_payments_kpi,
        subsidiary_breakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});
