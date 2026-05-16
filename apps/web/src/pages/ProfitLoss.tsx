/**
 * /reports/profit-loss — Gelir / Gider tablosu.
 *
 * Period seçici: bu ay, bu çeyrek, bu yıl, custom.
 * KPI: gelir, gider, brüt kar, amortisman, net kar, marj.
 * Aylık trend chart, kategori bazlı gider pie.
 */
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  FileBarChart2,
  Minus,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface PnL {
  period: { from: string; to: string };
  revenue: {
    total: number;
    invoice_count: number;
    by_month: Array<{ ym: string; total: number }>;
  };
  expenses: {
    total: number;
    invoice_count: number;
    by_category: Array<{ category: string; category_label: string; count: number; total: number }>;
    by_month: Array<{ ym: string; total: number }>;
  };
  depreciation: {
    total: number;
    by_month: Array<{ ym: string; total: number }>;
  };
  gross_profit: number;
  net_profit: number;
  margin_pct: number;
}

function fmtTRY(v: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
}

function thisMonth(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function thisYear(): { from: string; to: string } {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

function lastMonths(n: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - n + 1, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

const PIE_COLORS = [
  '#0a2540',
  '#f97316',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#ec4899',
  '#14b8a6',
];

export function ProfitLossPage() {
  const active = useAuth((s) => s.active);
  const [range, setRange] = useState(lastMonths(3));

  const q = useQuery({
    queryKey: ['pnl', active.tenantSlug, active.aggregate, range.from, range.to],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: PnL }>(
        `/reports/profit-loss?from=${range.from}&to=${range.to}`,
      );
      return res.data.data;
    },
  });

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşeden bir şirket seç veya "Tüm Şirketler" seç.
          </p>
        </div>
      </div>
    );
  }

  // Trend chart için aylık birleşik veri
  const months = new Set<string>();
  for (const m of q.data?.revenue.by_month ?? []) months.add(m.ym);
  for (const m of q.data?.expenses.by_month ?? []) months.add(m.ym);
  for (const m of q.data?.depreciation.by_month ?? []) months.add(m.ym);

  const trendData = Array.from(months)
    .sort()
    .map((ym) => ({
      ym,
      revenue: q.data?.revenue.by_month.find((m) => m.ym === ym)?.total ?? 0,
      expenses: q.data?.expenses.by_month.find((m) => m.ym === ym)?.total ?? 0,
      depreciation: q.data?.depreciation.by_month.find((m) => m.ym === ym)?.total ?? 0,
    }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Rapor</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <FileBarChart2 className="size-6" />
          Gelir / Gider Tablosu (P&L)
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Satış faturaları → gelir, alış faturaları → gider, amortisman düşülerek net kar.
        </p>
      </header>

      {/* Period selector */}
      <div className="card mb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setRange(thisMonth())}
          className="text-xs bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
        >
          Bu Ay
        </button>
        <button
          onClick={() => setRange(lastMonths(3))}
          className="text-xs bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
        >
          Son 3 Ay
        </button>
        <button
          onClick={() => setRange(lastMonths(6))}
          className="text-xs bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
        >
          Son 6 Ay
        </button>
        <button
          onClick={() => setRange(lastMonths(12))}
          className="text-xs bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
        >
          Son 12 Ay
        </button>
        <button
          onClick={() => setRange(thisYear())}
          className="text-xs bg-brand-50 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
        >
          Bu Yıl
        </button>
        <span className="ml-auto text-xs text-brand-500 font-mono">
          {range.from} → {range.to}
        </span>
      </div>

      {q.isLoading && <p className="text-brand-500 text-sm">Hesaplanıyor…</p>}

      {q.data && (
        <>
          {/* KPI özet */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="card bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700 flex items-center gap-1">
                <ArrowUpRight className="size-3" />
                Gelir
              </p>
              <p className="text-xl font-semibold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
                {fmtTRY(q.data.revenue.total)}
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {q.data.revenue.invoice_count} satış fatura
              </p>
            </div>
            <div className="card bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-800">
              <p className="text-[10px] uppercase tracking-wide text-red-700 flex items-center gap-1">
                <ArrowDownRight className="size-3" />
                Gider
              </p>
              <p className="text-xl font-semibold font-mono mt-1 text-red-700 dark:text-red-400">
                {fmtTRY(q.data.expenses.total)}
              </p>
              <p className="text-[10px] text-red-600 mt-0.5">
                {q.data.expenses.invoice_count} alış fatura
              </p>
            </div>
            <div className="card">
              <p className="text-[10px] uppercase tracking-wide text-brand-500">Brüt Kar</p>
              <p
                className={`text-xl font-semibold font-mono mt-1 ${
                  q.data.gross_profit >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600'
                }`}
              >
                {fmtTRY(q.data.gross_profit)}
              </p>
            </div>
            <div className="card bg-amber-50/40 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
              <p className="text-[10px] uppercase tracking-wide text-amber-700 flex items-center gap-1">
                <Minus className="size-3" />
                Amortisman
              </p>
              <p className="text-xl font-semibold font-mono mt-1 text-amber-700 dark:text-amber-400">
                {fmtTRY(q.data.depreciation.total)}
              </p>
            </div>
            <div className="card bg-purple-50/40 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
              <p className="text-[10px] uppercase tracking-wide text-purple-700 flex items-center gap-1">
                <TrendingUp className="size-3" />
                Net Kar
              </p>
              <p
                className={`text-xl font-semibold font-mono mt-1 ${
                  q.data.net_profit >= 0
                    ? 'text-purple-700 dark:text-purple-400'
                    : 'text-red-600'
                }`}
              >
                {fmtTRY(q.data.net_profit)}
              </p>
              <p className="text-[10px] text-purple-600 mt-0.5">Marj %{q.data.margin_pct}</p>
            </div>
          </div>

          {/* Aylık trend chart */}
          {trendData.length > 0 && (
            <section className="card mb-6">
              <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-3">
                Aylık Trend
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="ym" stroke="#6b7280" fontSize={12} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => fmtTRY(Number(v))}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="depreciation"
                    name="Amortisman"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Kategori bazlı gider pie */}
          {q.data.expenses.by_category.length > 0 && (
            <section className="card mb-6">
              <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-3">
                Kategori Bazlı Gider Dağılımı
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={q.data.expenses.by_category.slice(0, 10)}
                      dataKey="total"
                      nameKey="category_label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                    >
                      {q.data.expenses.by_category.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtTRY(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <table className="w-full text-sm self-start">
                  <thead>
                    <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                      <th className="py-2 px-2">Kategori</th>
                      <th className="py-2 px-2 text-right">Adet</th>
                      <th className="py-2 px-2 text-right">Toplam</th>
                      <th className="py-2 px-2 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.expenses.by_category.slice(0, 12).map((c, i) => {
                      const pct = (c.total / q.data!.expenses.total) * 100;
                      return (
                        <tr key={c.category} className="border-b border-brand-50 dark:border-slate-800/50">
                          <td className="py-1.5 px-2">
                            <span
                              className="inline-block size-2.5 rounded-sm mr-2"
                              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                            {c.category_label}
                          </td>
                          <td className="py-1.5 px-2 text-right text-brand-500">{c.count}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{fmtTRY(c.total)}</td>
                          <td className="py-1.5 px-2 text-right text-xs">%{pct.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
