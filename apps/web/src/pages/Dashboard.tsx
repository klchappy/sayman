import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  Coins,
  FileText,
  HomeIcon,
  Landmark,
  Network,
  Repeat,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Module } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface DashboardSummary {
  cashflow_6mo: Array<{ month: string; outflow: number; inflow: number }>;
  payables_summary: {
    total: number;
    paid: number;
    open: number;
    overdue_count: number;
    approaching_count: number;
  };
  upcoming_payables: Array<{
    id: string;
    title: string;
    amount: string;
    due_date: string;
    status: string;
  }>;
  subscriptions: { active_count: number; monthly_total: number; commitment_expiring_60: number };
  guarantees: { active_count: number; total_amount: number; expiring_60: number };
  official_payments: { this_month_amount: number; next_30_count: number };
  regular_payments: { this_month_amount: number; next_30_count: number };
  subsidiary_breakdown: Array<{
    id: string;
    name: string;
    color: string | null;
    total_payables: number;
  }>;
}

interface TenantInfo {
  slug: string;
  effective_modules: Module[];
}

function fmtTRY(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  approaching: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  approaching: 'Yaklaşıyor',
  overdue: 'Geciken',
};

export function DashboardPage() {
  const active = useAuth((s) => s.active);

  const tenantsQ = useQuery({
    queryKey: ['tenants-for-menu', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: TenantInfo[] }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });

  const summaryQ = useQuery({
    queryKey: ['dashboard-summary', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: DashboardSummary }>('/dashboard/summary');
      return res.data.data;
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşedeki seçiciden bir sektör (tenant) seç.
          </p>
        </div>
      </div>
    );
  }

  const summary = summaryQ.data;
  const activeTenant = tenantsQ.data?.find((t) => t.slug === active.tenantSlug);
  const modules = new Set(activeTenant?.effective_modules ?? []);

  const has = (m: Module) => modules.has(m);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
          {active.orgSlug} / {active.tenantSlug}
        </p>
        <h1 className="text-2xl font-semibold text-brand-900">Operasyon Dashboard</h1>
      </header>

      {summaryQ.isLoading && (
        <p className="text-sm text-brand-500">Yükleniyor…</p>
      )}

      {summary && (
        <>
          {/* === KPI Cards === */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {has('finance') && (
              <>
                <KpiCard
                  label="Toplam Fatura Tutarı"
                  value={fmtTRY(summary.payables_summary.total)}
                  icon={<FileText className="size-4 text-brand-300" />}
                />
                <KpiCard
                  label="Açık Bakiye"
                  value={fmtTRY(summary.payables_summary.open)}
                  icon={<Clock className="size-4 text-amber-400" />}
                  highlight="amber"
                />
                <KpiCard
                  label="Geciken Fatura"
                  value={String(summary.payables_summary.overdue_count)}
                  icon={<AlertCircle className="size-4 text-red-400" />}
                  highlight="red"
                />
                <KpiCard
                  label="Yaklaşan (≤3 gün)"
                  value={String(summary.payables_summary.approaching_count)}
                  icon={<Clock className="size-4 text-amber-400" />}
                />
              </>
            )}
          </div>

          {/* === Cashflow chart === */}
          {has('finance') && (
            <section className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-brand-900 flex items-center gap-2">
                  <TrendingDown className="size-5" />
                  Nakit Çıkışı (Son 6 Ay)
                </h2>
                <span className="text-xs text-brand-400">payment_transactions toplamı</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.cashflow_6mo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => fmtTRY(Number(v))}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="outflow" fill="#0a2540" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* === Module-spesifik widget grid === */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {has('subscriptions') && (
              <ModuleCard
                title="Abonelikler"
                icon={<Repeat className="size-5" />}
                link="/subscriptions"
                stats={[
                  { label: 'Aktif', value: String(summary.subscriptions.active_count) },
                  { label: 'Aylık toplam', value: fmtTRY(summary.subscriptions.monthly_total) },
                  {
                    label: 'Taahhüt T-60',
                    value: String(summary.subscriptions.commitment_expiring_60),
                    warning: summary.subscriptions.commitment_expiring_60 > 0,
                  },
                ]}
              />
            )}

            {has('guarantees') && (
              <ModuleCard
                title="Teminat Mektupları"
                icon={<ShieldCheck className="size-5" />}
                link="/guarantees"
                stats={[
                  { label: 'Aktif', value: String(summary.guarantees.active_count) },
                  { label: 'Toplam tutar', value: fmtTRY(summary.guarantees.total_amount) },
                  {
                    label: 'Vade T-60',
                    value: String(summary.guarantees.expiring_60),
                    warning: summary.guarantees.expiring_60 > 0,
                  },
                ]}
              />
            )}

            {has('official_payments') && (
              <ModuleCard
                title="Resmi Ödemeler"
                icon={<Landmark className="size-5" />}
                link="/official-payments"
                stats={[
                  { label: 'Bu ay', value: fmtTRY(summary.official_payments.this_month_amount) },
                  {
                    label: 'Sonraki 30 gün',
                    value: String(summary.official_payments.next_30_count),
                  },
                ]}
              />
            )}

            {has('regular_payments') && (
              <ModuleCard
                title="Kira / Düzenli"
                icon={<HomeIcon className="size-5" />}
                link="/regular-payments"
                stats={[
                  { label: 'Bu ay', value: fmtTRY(summary.regular_payments.this_month_amount) },
                  {
                    label: 'Sonraki 30 gün',
                    value: String(summary.regular_payments.next_30_count),
                  },
                ]}
              />
            )}
          </div>

          {/* === Subsidiary breakdown === */}
          {summary.subsidiary_breakdown.length > 0 && (
            <section className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-brand-900 flex items-center gap-2">
                  <Network className="size-5" />
                  Yan Şirket Bazında Toplam Fatura
                </h2>
                <span className="text-xs text-brand-400">payable_items SUM(amount)</span>
              </div>
              <div className="space-y-2">
                {summary.subsidiary_breakdown.map((s) => {
                  const max = Math.max(
                    ...summary.subsidiary_breakdown.map((x) => x.total_payables),
                    1,
                  );
                  const pct = (s.total_payables / max) * 100;
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-40 truncate text-sm text-brand-700">{s.name}</div>
                      <div className="flex-1 bg-brand-50 rounded-full h-6 relative overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: s.color ?? '#0a2540',
                          }}
                        />
                      </div>
                      <div className="w-32 text-right font-mono text-sm text-brand-900">
                        {fmtTRY(s.total_payables)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* === Upcoming payables === */}
          {has('finance') && (
            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-brand-900">Yaklaşan Faturalar</h2>
                <Link to="/payables" className="text-xs text-brand-600 hover:text-brand-900">
                  Tümü →
                </Link>
              </div>
              {summary.upcoming_payables.length === 0 ? (
                <p className="text-sm text-brand-500">Yaklaşan fatura yok.</p>
              ) : (
                <ul className="divide-y divide-brand-100">
                  {summary.upcoming_payables.map((p) => (
                    <li key={p.id} className="py-3 flex items-center justify-between">
                      <div>
                        <Link
                          to={`/payables/${p.id}`}
                          className="font-medium text-brand-900 hover:text-brand-700"
                        >
                          {p.title}
                        </Link>
                        <p className="text-xs text-brand-500">Vade: {p.due_date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-brand-900">{fmtTRY(p.amount)}</p>
                        <span className={`badge ${STATUS_BADGE[p.status] ?? ''}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: 'amber' | 'red';
}) {
  const valClass =
    highlight === 'amber'
      ? 'text-amber-700'
      : highlight === 'red'
        ? 'text-red-600'
        : 'text-brand-900';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-brand-500 uppercase">{label}</span>
        {icon}
      </div>
      <p className={`text-xl font-semibold font-mono ${valClass}`}>{value}</p>
    </div>
  );
}

function ModuleCard({
  title,
  icon,
  link,
  stats,
}: {
  title: string;
  icon: React.ReactNode;
  link: string;
  stats: Array<{ label: string; value: string; warning?: boolean }>;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-brand-900 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <Link to={link} className="text-xs text-brand-600 hover:text-brand-900">
          Aç →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-wide text-brand-400">{s.label}</p>
            <p
              className={`font-semibold font-mono mt-1 ${s.warning ? 'text-amber-700' : 'text-brand-900'}`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
