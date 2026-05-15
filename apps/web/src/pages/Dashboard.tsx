import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  Coins,
  FileText,
  HomeIcon,
  Landmark,
  Loader2,
  Network,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Module } from '@sayman/shared';
import { PendingReviewDashboardWidget } from '../components/PendingReviewBanner';
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

  // Aggregate mode'da tenantSlug null ama veri yine de gelir (backend org-wide döner)
  const summaryQ = useQuery({
    queryKey: ['dashboard-summary', active.orgSlug, active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: DashboardSummary }>('/dashboard/summary');
      return res.data.data;
    },
  });

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşedeki seçiciden bir sektör (tenant) seç veya "Tüm Şirketler" mod'una geç.
          </p>
        </div>
      </div>
    );
  }

  const summary = summaryQ.data;
  const activeTenant = tenantsQ.data?.find((t) => t.slug === active.tenantSlug);
  // Aggregate modda tüm modüller "var" sayılır (org-wide tüm tenants)
  const modules = active.aggregate
    ? new Set(tenantsQ.data?.flatMap((t) => t.effective_modules) ?? [])
    : new Set(activeTenant?.effective_modules ?? []);

  const has = (m: Module) => modules.has(m);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
          {active.orgSlug}
          {active.aggregate
            ? ` / Tüm Şirketler (${tenantsQ.data?.length ?? 0})`
            : active.tenantSlug
              ? ` / ${active.tenantSlug}`
              : ''}
        </p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100">
          {active.aggregate ? 'Konsolide Dashboard' : 'Operasyon Dashboard'}
        </h1>
      </header>

      {summaryQ.isLoading && (
        <p className="text-sm text-brand-500">Yükleniyor…</p>
      )}

      {summary && (
        <>
          {/* === Doğrulama Bekleyenler (auto-created records) === */}
          <PendingReviewDashboardWidget />

          {/* === AI Summary Widget === */}
          <AISummaryWidget />

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

          {/* === Forecast Widget === */}
          {has('finance') && <ForecastWidget />}

          {/* === Alacak KPI Widget === */}
          {has('finance') && <SalesKpiWidget />}

          {/* === Bütçe widget === */}
          {has('finance') && <BudgetWidget />}

          {/* === Çek/Senet özet === */}
          {has('finance') && <ChecksWidget />}

          {/* === Demirbaş özet === */}
          {has('finance') && <FixedAssetsWidget />}

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

interface AISummaryRow {
  id: string;
  summary_date: string;
  summary_text: string;
  source_data: Record<string, unknown>;
  created_at: string;
}

function AISummaryWidget() {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ['ai-summary-today'],
    queryFn: async () => {
      const res = await api.get<{ data: AISummaryRow | null }>('/ai/summary/today');
      return res.data.data;
    },
  });

  const regen = useMutation({
    mutationFn: async () => {
      await api.post('/ai/summary/regenerate');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-summary-today'] }),
  });

  return (
    <section className="card mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
      <div className="flex items-start justify-between mb-2">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2">
          <Sparkles className="size-5 text-purple-600" />
          Bugünün Özeti
        </h2>
        <button
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
          className="text-xs text-brand-600 hover:text-brand-900 flex items-center gap-1"
          title="Yeniden üret"
        >
          {regen.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Yenile
        </button>
      </div>
      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
      {q.data ? (
        <>
          <p className="text-sm text-brand-800 whitespace-pre-line">{q.data.summary_text}</p>
          <p className="text-[10px] text-brand-400 mt-2 font-mono">
            {q.data.summary_date} · cron@07:00 TR
          </p>
        </>
      ) : (
        !q.isLoading && (
          <p className="text-sm text-brand-500 italic">
            AI özet henüz hazır değil. ANTHROPIC_API_KEY yapılandırıldıysa cron 07:00'de üretir.
          </p>
        )
      )}
    </section>
  );
}

interface ForecastResponse {
  past: Array<{ ym: string; total_expense: number }>;
  future: Array<{ ym: string; projected_expense: number }>;
  trend: { slope: number; intercept: number; r_squared: number; direction: string };
}

function ForecastWidget() {
  const q = useQuery({
    queryKey: ['forecast-cashflow'],
    queryFn: async () => {
      const res = await api.get<{ data: ForecastResponse }>('/forecast/cashflow?months=6');
      return res.data.data;
    },
  });

  if (!q.data) return null;

  const combined = [
    ...q.data.past.map((p) => ({ ym: p.ym, real: p.total_expense, projected: null as number | null })),
    ...q.data.future.map((f) => ({ ym: f.ym, real: null as number | null, projected: f.projected_expense })),
  ];

  const Icon = q.data.trend.direction === 'rising' ? TrendingUp : TrendingDown;
  const trendLabel =
    q.data.trend.direction === 'rising'
      ? 'Yükselen trend'
      : q.data.trend.direction === 'falling'
        ? 'Düşen trend'
        : 'Sabit trend';
  const r2 = (q.data.trend.r_squared * 100).toFixed(0);

  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-brand-900 flex items-center gap-2">
          <Icon
            className={`size-5 ${q.data.trend.direction === 'rising' ? 'text-red-500' : 'text-emerald-500'}`}
          />
          Nakit Akış Tahmini (Lineer Regresyon)
        </h2>
        <span className="text-xs text-brand-400">
          {trendLabel} · R²={r2}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={combined}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="ym" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v) => (v != null ? fmtTRY(Number(v)) : '-')}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="real" name="Gerçekleşen" fill="#0a2540" radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="projected"
            name="Projeksiyon"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#f97316', r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

interface SalesSummaryData {
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  collected_this_month: number;
  invoice_count: number;
}

interface BudgetComparison {
  period: string;
  items: Array<{
    id: string;
    category_label: string;
    planned: number;
    actual: number;
    usage_pct: number;
    over_budget: boolean;
  }>;
}

function BudgetWidget() {
  const q = useQuery({
    queryKey: ['budget-comparison-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: BudgetComparison }>('/budgets/comparison');
      return res.data.data;
    },
  });

  if (!q.data || q.data.items.length === 0) return null;

  // En kritik 5'i göster
  const top = q.data.items.slice(0, 5);

  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Target className="size-5 text-amber-600" />
          Bütçe Kullanım ({q.data.period})
        </h2>
        <Link
          to="/budgets"
          className="text-xs text-brand-600 dark:text-slate-400 hover:text-brand-900"
        >
          Tümü →
        </Link>
      </div>
      <div className="space-y-2">
        {top.map((b) => (
          <div key={b.id} className="flex items-center gap-3 text-sm">
            <span className="w-32 truncate text-brand-700 dark:text-slate-300">
              {b.category_label}
            </span>
            <div className="flex-1 bg-brand-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  b.over_budget
                    ? 'bg-red-500'
                    : b.usage_pct >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(b.usage_pct, 100)}%` }}
              />
            </div>
            <span
              className={`font-mono text-xs w-12 text-right ${
                b.over_budget
                  ? 'text-red-600 font-semibold'
                  : 'text-brand-700 dark:text-slate-300'
              }`}
            >
              %{b.usage_pct.toFixed(0)}
            </span>
            <span className="font-mono text-xs text-brand-500 w-24 text-right hidden sm:inline">
              {fmtTRY(b.actual)} / {fmtTRY(b.planned)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ChecksSummaryData {
  portfolio: { count: number; amount: number };
  deposited: { count: number; amount: number };
  outgoing_pending: { count: number; amount: number };
  due_next_30d: { count: number; amount: number };
  returned: { count: number; amount: number };
}

interface FixedAssetsSummary {
  total_cost: number;
  total_accumulated_depreciation: number;
  net_book_value: number;
  active_count: number;
  disposed_count: number;
}

function FixedAssetsWidget() {
  const q = useQuery({
    queryKey: ['fixed-assets-summary-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: FixedAssetsSummary }>('/fixed-assets/summary');
      return res.data.data;
    },
  });

  if (!q.data || q.data.active_count === 0) return null;

  const pct = q.data.total_cost > 0 ? (q.data.total_accumulated_depreciation / q.data.total_cost) * 100 : 0;

  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100">📦 Demirbaş Özet</h2>
        <Link
          to="/fixed-assets"
          className="text-xs text-brand-600 dark:text-slate-400 hover:text-brand-900"
        >
          Tümü →
        </Link>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Toplam Maliyet</p>
          <p className="text-lg font-semibold font-mono mt-1 text-brand-900 dark:text-slate-100">
            {fmtTRY(q.data.total_cost)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.active_count} aktif</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Birikmiş Amortisman</p>
          <p className="text-lg font-semibold font-mono mt-1 text-amber-700 dark:text-amber-400">
            {fmtTRY(q.data.total_accumulated_depreciation)}
          </p>
          <p className="text-[10px] text-brand-400">%{pct.toFixed(0)} tükenmiş</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Net Defter Değeri</p>
          <p className="text-lg font-semibold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
            {fmtTRY(q.data.net_book_value)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Çıkarılmış</p>
          <p className="text-lg font-semibold mt-1 text-brand-700 dark:text-slate-300">
            {q.data.disposed_count}
          </p>
        </div>
      </div>
    </section>
  );
}

function ChecksWidget() {
  const q = useQuery({
    queryKey: ['checks-summary-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: ChecksSummaryData }>('/checks/summary');
      return res.data.data;
    },
  });

  if (
    !q.data ||
    (q.data.portfolio.count === 0 &&
      q.data.outgoing_pending.count === 0 &&
      q.data.due_next_30d.count === 0)
  ) {
    return null;
  }

  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100">
          📜 Çek / Senet Özet
        </h2>
        <Link
          to="/checks"
          className="text-xs text-brand-600 dark:text-slate-400 hover:text-brand-900"
        >
          Tümü →
        </Link>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Portföyde</p>
          <p className="text-lg font-semibold font-mono mt-1 text-blue-700 dark:text-blue-400">
            {fmtTRY(q.data.portfolio.amount)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.portfolio.count} adet</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Bankada</p>
          <p className="text-lg font-semibold font-mono mt-1 text-amber-700 dark:text-amber-400">
            {fmtTRY(q.data.deposited.amount)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.deposited.count} adet</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Ödenecek (Çıkan)</p>
          <p className="text-lg font-semibold font-mono mt-1 text-purple-700 dark:text-purple-400">
            {fmtTRY(q.data.outgoing_pending.amount)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.outgoing_pending.count} adet</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">30 Gün Vade</p>
          <p
            className={`text-lg font-semibold font-mono mt-1 ${
              q.data.due_next_30d.count > 0
                ? 'text-red-600'
                : 'text-brand-900 dark:text-slate-100'
            }`}
          >
            {fmtTRY(q.data.due_next_30d.amount)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.due_next_30d.count} adet</p>
        </div>
      </div>
    </section>
  );
}

function SalesKpiWidget() {
  const q = useQuery({
    queryKey: ['sales-summary-dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: SalesSummaryData }>('/sales-invoices/summary');
      return res.data.data;
    },
  });

  if (!q.data || q.data.invoice_count === 0) return null;

  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Coins className="size-5 text-emerald-600" />
          Alacak Özet
        </h2>
        <Link
          to="/sales-invoices"
          className="text-xs text-brand-600 dark:text-slate-400 hover:text-brand-900"
        >
          Tümü →
        </Link>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Toplam Alacak</p>
          <p className="text-xl font-semibold font-mono mt-1 text-brand-900 dark:text-slate-100">
            {fmtTRY(q.data.outstanding)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Geciken</p>
          <p
            className={`text-xl font-semibold font-mono mt-1 ${
              q.data.overdue_count > 0 ? 'text-red-600' : 'text-brand-900 dark:text-slate-100'
            }`}
          >
            {fmtTRY(q.data.overdue_amount)}
          </p>
          <p className="text-[10px] text-brand-400">{q.data.overdue_count} fatura</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Bu Ay Tahsil</p>
          <p className="text-xl font-semibold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
            {fmtTRY(q.data.collected_this_month)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Fatura Sayısı</p>
          <p className="text-xl font-semibold mt-1 text-brand-900 dark:text-slate-100">
            {q.data.invoice_count}
          </p>
        </div>
      </div>
    </section>
  );
}
