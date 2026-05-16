/**
 * /raporlar/konsolide — Konsolide P&L + Bilanço (cross-tenant admin görünümü).
 *
 * Admin "Tüm Şirketler" modunda en güçlü çalışır — per-tenant breakdown +
 * grand total. Tek tenant'taysa sadece o tenant gösterilir.
 */
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  FileBarChart2,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtTRYShort } from '../lib/formatting';

interface PnlByTenant {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  revenue: number;
  expenses: number;
  depreciation: number;
  gross_profit: number;
  net_profit: number;
  margin_pct: number;
}

interface PnlData {
  period: { from: string; to: string };
  tenant_count: number;
  grand_total: {
    revenue: number;
    expenses: number;
    depreciation: number;
    gross_profit: number;
    net_profit: number;
    margin_pct: number;
  };
  by_tenant: PnlByTenant[];
  by_month: Array<{ ym: string; revenue: number; expenses: number; profit: number }>;
  by_category: Array<{ category: string; count: number; total: number }>;
}

interface BalanceByTenant {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  fixed_assets_net: number;
  receivables: number;
  payables: number;
  total_assets: number;
  total_liabilities: number;
  equity: number;
}

interface BalanceData {
  as_of: string;
  tenant_count: number;
  grand_total: {
    fixed_assets_net: number;
    receivables: number;
    payables: number;
    total_assets: number;
    total_liabilities: number;
    equity: number;
  };
  by_tenant: BalanceByTenant[];
}

function defaultFromTo(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export function ConsolidatedReportsPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const [tab, setTab] = useState<'pnl' | 'balance'>('pnl');
  const [from, setFrom] = useState(defaultFromTo().from);
  const [to, setTo] = useState(defaultFromTo().to);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canAccess = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(
    role ?? '',
  );

  const pnlQ = useQuery({
    queryKey: ['consolidated-pnl', active.tenantSlug, active.aggregate, from, to],
    enabled:
      canAccess && tab === 'pnl' && (!!active.tenantSlug || active.aggregate === true) && !!from && !!to,
    queryFn: async () => {
      const res = await api.get<{ data: PnlData }>(
        `/reports/consolidated/profit-loss?from=${from}&to=${to}`,
      );
      return res.data.data;
    },
  });

  const balanceQ = useQuery({
    queryKey: ['consolidated-balance', active.tenantSlug, active.aggregate, asOf],
    enabled:
      canAccess &&
      tab === 'balance' &&
      (!!active.tenantSlug || active.aggregate === true) &&
      !!asOf,
    queryFn: async () => {
      const res = await api.get<{ data: BalanceData }>(
        `/reports/consolidated/balance-sheet?as_of=${asOf}`,
      );
      return res.data.data;
    },
  });

  if (!canAccess) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <FileBarChart2 className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 font-medium">Yetkisiz erişim</p>
          <p className="text-sm text-brand-500 mt-1">
            Konsolide rapor sadece yönetici/muhasebeci/admin için.
          </p>
        </div>
      </div>
    );
  }

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Şirket seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Bir şirket seç veya "Tüm Şirketler" modunu açarak konsolide görünüme geç.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Raporlar</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="size-6" />
          Konsolide Rapor
          {active.aggregate && (
            <span className="text-[10px] uppercase tracking-wide bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
              Tüm Şirketler
            </span>
          )}
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Cross-tenant gelir/gider tablosu ve bilanço özet. Her şirket için ayrı satır + grand total.
        </p>
      </header>

      {/* Tab + Filter */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex gap-1 bg-brand-100 dark:bg-slate-800 rounded p-1">
          <button
            onClick={() => setTab('pnl')}
            className={`px-3 py-1.5 text-sm rounded ${
              tab === 'pnl'
                ? 'bg-white dark:bg-slate-900 text-brand-900 dark:text-slate-100 shadow'
                : 'text-brand-600 dark:text-slate-400'
            }`}
          >
            Gelir/Gider (P&L)
          </button>
          <button
            onClick={() => setTab('balance')}
            className={`px-3 py-1.5 text-sm rounded ${
              tab === 'balance'
                ? 'bg-white dark:bg-slate-900 text-brand-900 dark:text-slate-100 shadow'
                : 'text-brand-600 dark:text-slate-400'
            }`}
          >
            Bilanço
          </button>
        </div>
        <div className="flex-1" />
        {tab === 'pnl' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-brand-200 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-900"
            />
            <span className="text-brand-400">—</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-brand-200 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-900"
            />
          </div>
        )}
        {tab === 'balance' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-500">Tarih:</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded border border-brand-200 dark:border-slate-700 px-2 py-1.5 bg-white dark:bg-slate-900"
            />
          </div>
        )}
      </div>

      {/* P&L Tab */}
      {tab === 'pnl' && (
        <>
          {pnlQ.isLoading && <p className="text-brand-500 text-sm">Hesaplanıyor…</p>}
          {pnlQ.data && (
            <>
              {/* Grand Total KPI'lar */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <KpiCard
                  label="Gelir"
                  value={fmtTRYShort(pnlQ.data.grand_total.revenue)}
                  icon={<TrendingUp className="size-4" />}
                  color="emerald"
                />
                <KpiCard
                  label="Gider"
                  value={fmtTRYShort(pnlQ.data.grand_total.expenses)}
                  icon={<Wallet className="size-4" />}
                  color="red"
                />
                <KpiCard
                  label="Amortisman"
                  value={fmtTRYShort(pnlQ.data.grand_total.depreciation)}
                  color="brand"
                />
                <KpiCard
                  label="Brüt Kar"
                  value={fmtTRYShort(pnlQ.data.grand_total.gross_profit)}
                  color={pnlQ.data.grand_total.gross_profit >= 0 ? 'emerald' : 'red'}
                />
                <KpiCard
                  label="Net Kar"
                  value={fmtTRYShort(pnlQ.data.grand_total.net_profit)}
                  sub={`${pnlQ.data.grand_total.margin_pct.toFixed(1)}% marj`}
                  color={pnlQ.data.grand_total.net_profit >= 0 ? 'emerald' : 'red'}
                />
              </div>

              {/* Per-tenant breakdown */}
              <div className="card mb-6">
                <h2 className="font-semibold mb-3 text-brand-900 dark:text-slate-100">
                  Şirket Bazında ({pnlQ.data.tenant_count})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                        <th className="py-2 px-2">Şirket</th>
                        <th className="py-2 px-2 text-right">Gelir</th>
                        <th className="py-2 px-2 text-right">Gider</th>
                        <th className="py-2 px-2 text-right">Amortisman</th>
                        <th className="py-2 px-2 text-right">Brüt Kar</th>
                        <th className="py-2 px-2 text-right">Net Kar</th>
                        <th className="py-2 px-2 text-right">Marj</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pnlQ.data.by_tenant.map((t) => (
                        <tr key={t.tenant_id} className="border-b border-brand-50 hover:bg-brand-50/50">
                          <td className="py-2 px-2 font-medium text-brand-900">{t.tenant_name}</td>
                          <td className="py-2 px-2 font-mono text-right text-emerald-700">
                            {fmtTRYShort(t.revenue)}
                          </td>
                          <td className="py-2 px-2 font-mono text-right text-red-600">
                            {fmtTRYShort(t.expenses)}
                          </td>
                          <td className="py-2 px-2 font-mono text-right text-brand-600">
                            {fmtTRYShort(t.depreciation)}
                          </td>
                          <td
                            className={`py-2 px-2 font-mono text-right ${
                              t.gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {fmtTRYShort(t.gross_profit)}
                          </td>
                          <td
                            className={`py-2 px-2 font-mono text-right font-semibold ${
                              t.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {fmtTRYShort(t.net_profit)}
                          </td>
                          <td className="py-2 px-2 text-right text-xs text-brand-600">
                            {t.margin_pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-brand-300 dark:border-slate-600 font-semibold">
                        <td className="py-2 px-2">TOPLAM</td>
                        <td className="py-2 px-2 font-mono text-right text-emerald-700">
                          {fmtTRYShort(pnlQ.data.grand_total.revenue)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-red-700">
                          {fmtTRYShort(pnlQ.data.grand_total.expenses)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-brand-700">
                          {fmtTRYShort(pnlQ.data.grand_total.depreciation)}
                        </td>
                        <td
                          className={`py-2 px-2 font-mono text-right ${
                            pnlQ.data.grand_total.gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {fmtTRYShort(pnlQ.data.grand_total.gross_profit)}
                        </td>
                        <td
                          className={`py-2 px-2 font-mono text-right ${
                            pnlQ.data.grand_total.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {fmtTRYShort(pnlQ.data.grand_total.net_profit)}
                        </td>
                        <td className="py-2 px-2 text-right text-xs">
                          {pnlQ.data.grand_total.margin_pct.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Aylık trend */}
              {pnlQ.data.by_month.length > 0 && (
                <div className="card mb-6">
                  <h2 className="font-semibold mb-3 text-brand-900 dark:text-slate-100">
                    Aylık Trend
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                          <th className="py-2 px-2">Ay</th>
                          <th className="py-2 px-2 text-right">Gelir</th>
                          <th className="py-2 px-2 text-right">Gider</th>
                          <th className="py-2 px-2 text-right">Kar/Zarar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnlQ.data.by_month.map((m) => (
                          <tr key={m.ym} className="border-b border-brand-50">
                            <td className="py-1.5 px-2 font-mono">{m.ym}</td>
                            <td className="py-1.5 px-2 font-mono text-right text-emerald-700">
                              {fmtTRYShort(m.revenue)}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-right text-red-600">
                              {fmtTRYShort(m.expenses)}
                            </td>
                            <td
                              className={`py-1.5 px-2 font-mono text-right ${
                                m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {fmtTRYShort(m.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top gider kategorileri */}
              {pnlQ.data.by_category.length > 0 && (
                <div className="card">
                  <h2 className="font-semibold mb-3 text-brand-900 dark:text-slate-100">
                    Top Gider Kategorileri
                  </h2>
                  <div className="space-y-1">
                    {pnlQ.data.by_category.slice(0, 10).map((c) => {
                      const pct =
                        pnlQ.data!.grand_total.expenses > 0
                          ? (c.total / pnlQ.data!.grand_total.expenses) * 100
                          : 0;
                      return (
                        <div key={c.category} className="flex items-center gap-3">
                          <span className="text-xs text-brand-700 dark:text-slate-300 w-32 truncate">
                            {c.category}
                          </span>
                          <div className="flex-1 bg-brand-100 dark:bg-slate-800 rounded h-5 relative overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 bg-brand-500 dark:bg-brand-400 rounded"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-right w-24">
                            {fmtTRYShort(c.total)}
                          </span>
                          <span className="text-[10px] text-brand-500 w-10 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Balance Sheet Tab */}
      {tab === 'balance' && (
        <>
          {balanceQ.isLoading && <p className="text-brand-500 text-sm">Hesaplanıyor…</p>}
          {balanceQ.data && (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <KpiCard
                  label="Toplam Varlık"
                  value={fmtTRYShort(balanceQ.data.grand_total.total_assets)}
                  icon={<Wallet className="size-4" />}
                  color="emerald"
                />
                <KpiCard
                  label="Toplam Borç"
                  value={fmtTRYShort(balanceQ.data.grand_total.total_liabilities)}
                  color="red"
                />
                <KpiCard
                  label="Özsermaye"
                  value={fmtTRYShort(balanceQ.data.grand_total.equity)}
                  icon={<Scale className="size-4" />}
                  color={balanceQ.data.grand_total.equity >= 0 ? 'emerald' : 'red'}
                />
              </div>

              <div className="card">
                <h2 className="font-semibold mb-3 text-brand-900 dark:text-slate-100">
                  Şirket Bazında ({balanceQ.data.tenant_count})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                        <th className="py-2 px-2">Şirket</th>
                        <th className="py-2 px-2 text-right">Demirbaş (Net)</th>
                        <th className="py-2 px-2 text-right">Alacaklar</th>
                        <th className="py-2 px-2 text-right">Toplam Varlık</th>
                        <th className="py-2 px-2 text-right">Borçlar</th>
                        <th className="py-2 px-2 text-right">Özsermaye</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceQ.data.by_tenant.map((t) => (
                        <tr key={t.tenant_id} className="border-b border-brand-50 hover:bg-brand-50/50">
                          <td className="py-2 px-2 font-medium">{t.tenant_name}</td>
                          <td className="py-2 px-2 font-mono text-right">{fmtTRYShort(t.fixed_assets_net)}</td>
                          <td className="py-2 px-2 font-mono text-right text-blue-700">
                            {fmtTRYShort(t.receivables)}
                          </td>
                          <td className="py-2 px-2 font-mono text-right text-emerald-700">
                            {fmtTRYShort(t.total_assets)}
                          </td>
                          <td className="py-2 px-2 font-mono text-right text-red-600">
                            {fmtTRYShort(t.payables)}
                          </td>
                          <td
                            className={`py-2 px-2 font-mono text-right font-semibold ${
                              t.equity >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {fmtTRYShort(t.equity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-brand-300 dark:border-slate-600 font-semibold">
                        <td className="py-2 px-2">TOPLAM</td>
                        <td className="py-2 px-2 font-mono text-right">
                          {fmtTRYShort(balanceQ.data.grand_total.fixed_assets_net)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-blue-700">
                          {fmtTRYShort(balanceQ.data.grand_total.receivables)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-emerald-700">
                          {fmtTRYShort(balanceQ.data.grand_total.total_assets)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-red-700">
                          {fmtTRYShort(balanceQ.data.grand_total.total_liabilities)}
                        </td>
                        <td
                          className={`py-2 px-2 font-mono text-right ${
                            balanceQ.data.grand_total.equity >= 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {fmtTRYShort(balanceQ.data.grand_total.equity)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p className="text-xs text-brand-500 mt-4">
                * Varlıklar = Demirbaş (Net) + Alacaklar (Outstanding sales invoices) ·
                Borçlar = Ödenmemiş faturalar (Outstanding payables) · Özsermaye = Varlık − Borç
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  color = 'brand',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  color?: 'brand' | 'emerald' | 'red' | 'amber' | 'blue';
}) {
  const colorClasses: Record<string, string> = {
    brand: 'text-brand-700 dark:text-brand-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-red-700 dark:text-red-300',
    amber: 'text-amber-700 dark:text-amber-300',
    blue: 'text-blue-700 dark:text-blue-300',
  };
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-brand-500 dark:text-slate-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-xl font-semibold font-mono ${colorClasses[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-brand-500 mt-0.5">{sub}</p>}
    </div>
  );
}
