/**
 * /suppliers → liste, /suppliers/:name → detay.
 *
 * Tüm tedarikçilerin performans kartları: hacim, ortalama, ödeme dakikliği,
 * geçmiş trend grafiği, kategori dağılımı, son faturalar.
 */
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_LABELS, type PayableCategory } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface SupplierListItem {
  supplier_name: string;
  invoice_count: number;
  total_volume: number;
  avg_amount: number;
  paid_count: number;
  overdue_count: number;
  pending_count: number;
  avg_payment_delay_days: number;
  paid_on_time_pct: number | null;
  last_invoice_at: string;
  first_invoice_at: string;
}

interface SupplierDetail {
  supplier_name: string;
  summary: {
    invoice_count: number;
    total_volume: number;
    avg_amount: number;
    min_amount: number;
    max_amount: number;
    paid_count: number;
    overdue_count: number;
    avg_payment_delay_days: number;
    paid_on_time_pct: number | null;
  };
  monthly_trend: Array<{ ym: string; count: number; total: number }>;
  category_distribution: Array<{ category: string; count: number; total: number }>;
  recent_payables: Array<{
    id: string;
    title: string;
    amount: number;
    due_date: string | null;
    status: string;
    category: string | null;
    created_at: string;
  }>;
}

function fmtTRY(v: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(v);
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
];

export function SupplierScorecardListPage() {
  const active = useAuth((s) => s.active);
  const q = useQuery({
    queryKey: ['suppliers-scorecard', active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: SupplierListItem[] }>('/suppliers/scorecard');
      return res.data.data;
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Analitik</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Building2 className="size-6" />
          Tedarikçi Performans Karneleri
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Her tedarikçinin toplam hacmi, ödeme dakikliği ve fatura sıklığı.
        </p>
      </header>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {q.data && q.data.length === 0 && (
        <div className="card text-center text-brand-500">
          Henüz tedarikçi adı girilmiş bir fatura yok.
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Tedarikçi</th>
                <th className="py-2 px-2 text-right">Fatura</th>
                <th className="py-2 px-2 text-right">Toplam Hacim</th>
                <th className="py-2 px-2 text-right">Ortalama</th>
                <th className="py-2 px-2 text-right">Zamanında %</th>
                <th className="py-2 px-2 text-right">Ort. Gecikme</th>
                <th className="py-2 px-2 text-right">Geciken</th>
                <th className="py-2 px-2">Son Fatura</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((s) => (
                <tr key={s.supplier_name} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="py-2 px-2 font-medium">
                    <Link
                      to={`/suppliers/${encodeURIComponent(s.supplier_name)}`}
                      className="text-brand-900 hover:text-brand-700"
                    >
                      {s.supplier_name}
                    </Link>
                  </td>
                  <td className="py-2 px-2 text-right text-brand-700">{s.invoice_count}</td>
                  <td className="py-2 px-2 text-right font-mono font-semibold">
                    {fmtTRY(s.total_volume)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-brand-600">
                    {fmtTRY(s.avg_amount)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {s.paid_on_time_pct == null ? (
                      <span className="text-brand-400">-</span>
                    ) : (
                      <span
                        className={
                          s.paid_on_time_pct >= 80
                            ? 'text-emerald-700 font-medium'
                            : s.paid_on_time_pct >= 50
                              ? 'text-amber-700'
                              : 'text-red-600 font-medium'
                        }
                      >
                        {s.paid_on_time_pct}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right text-xs font-mono">
                    {s.avg_payment_delay_days > 0
                      ? `+${s.avg_payment_delay_days} gün`
                      : s.avg_payment_delay_days < 0
                        ? `${s.avg_payment_delay_days} gün`
                        : '0'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {s.overdue_count > 0 ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
                        {s.overdue_count}
                      </span>
                    ) : (
                      <span className="text-brand-400 text-xs">0</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-brand-500">
                    {s.last_invoice_at
                      ? new Date(s.last_invoice_at).toLocaleDateString('tr-TR')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SupplierScorecardDetailPage() {
  const { name } = useParams<{ name: string }>();
  const active = useAuth((s) => s.active);
  const q = useQuery({
    queryKey: ['supplier-scorecard-detail', active.tenantSlug, name],
    enabled: !!active.tenantSlug && !!name,
    queryFn: async () => {
      const res = await api.get<{ data: SupplierDetail }>(
        `/suppliers/${encodeURIComponent(name!)}/scorecard`,
      );
      return res.data.data;
    },
  });

  if (q.isLoading || !q.data) {
    return <div className="p-8 text-brand-500">Yükleniyor…</div>;
  }

  const s = q.data.summary;
  const cats = q.data.category_distribution;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        to="/suppliers"
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 mb-4"
      >
        <ArrowLeft className="size-4" />
        Tedarikçiler
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Tedarikçi Karne</p>
        <h1 className="text-2xl font-semibold text-brand-900">{q.data.supplier_name}</h1>
        <p className="text-sm text-brand-500 mt-1">
          {s.invoice_count} fatura · toplam {fmtTRY(s.total_volume)}
        </p>
      </header>

      {/* KPI grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Fatura Sayısı"
          value={String(s.invoice_count)}
          icon={<BarChart3 className="size-4 text-brand-300" />}
        />
        <Kpi
          label="Toplam Hacim"
          value={fmtTRY(s.total_volume)}
          icon={<TrendingUp className="size-4 text-brand-300" />}
        />
        <Kpi
          label="Ortalama Fatura"
          value={fmtTRY(s.avg_amount)}
          icon={<BarChart3 className="size-4 text-brand-300" />}
          subtext={`Min ${fmtTRY(s.min_amount)} / Max ${fmtTRY(s.max_amount)}`}
        />
        <Kpi
          label="Zamanında Ödeme"
          value={s.paid_on_time_pct == null ? '—' : `${s.paid_on_time_pct}%`}
          icon={<CheckCircle className="size-4 text-emerald-500" />}
          highlight={s.paid_on_time_pct != null && s.paid_on_time_pct < 50 ? 'red' : undefined}
        />
        <Kpi
          label="Ödenmiş"
          value={String(s.paid_count)}
          icon={<CheckCircle className="size-4 text-emerald-500" />}
        />
        <Kpi
          label="Geciken"
          value={String(s.overdue_count)}
          icon={<AlertCircle className="size-4 text-red-500" />}
          highlight={s.overdue_count > 0 ? 'red' : undefined}
        />
        <Kpi
          label="Ort. Gecikme"
          value={
            s.avg_payment_delay_days > 0
              ? `+${s.avg_payment_delay_days} gün`
              : s.avg_payment_delay_days < 0
                ? `${s.avg_payment_delay_days} gün`
                : '0 gün'
          }
          icon={<Clock className="size-4 text-amber-500" />}
          highlight={s.avg_payment_delay_days > 5 ? 'red' : undefined}
        />
      </div>

      {/* Aylık trend chart */}
      <section className="card mb-6">
        <h2 className="font-semibold text-brand-900 mb-4">Aylık Hacim (12 ay)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={q.data.monthly_trend}>
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
            <Bar dataKey="total" fill="#0a2540" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Kategori dağılımı */}
      {cats.length > 0 && (
        <section className="card mb-6">
          <h2 className="font-semibold text-brand-900 mb-4">Kategori Dağılımı</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={cats}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: { name?: string }) => {
                    const cat = entry.name ?? '';
                    return CATEGORY_LABELS[cat as PayableCategory] ?? cat;
                  }}
                >
                  {cats.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2">
              {cats.map((c, i) => (
                <li key={c.category} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 rounded-sm"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {CATEGORY_LABELS[c.category as PayableCategory] ?? c.category}
                  </span>
                  <span className="text-sm text-brand-700">
                    {c.count} · {fmtTRY(c.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Son 10 fatura */}
      <section className="card">
        <h2 className="font-semibold text-brand-900 mb-3">Son 10 Fatura</h2>
        <ul className="divide-y divide-brand-100">
          {q.data.recent_payables.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/payables/${p.id}`}
                  className="font-medium text-brand-900 hover:text-brand-700"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-brand-500">
                  {p.category && (
                    <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded mr-1">
                      {CATEGORY_LABELS[p.category as PayableCategory] ?? p.category}
                    </span>
                  )}
                  Vade: {p.due_date ?? '-'} · {p.status}
                </p>
              </div>
              <p className="font-mono">{fmtTRY(p.amount)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  subtext,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtext?: string;
  highlight?: 'red' | 'amber';
}) {
  const cls =
    highlight === 'red' ? 'text-red-600' : highlight === 'amber' ? 'text-amber-700' : 'text-brand-900';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-brand-500">{label}</span>
        {icon}
      </div>
      <p className={`text-lg font-semibold font-mono ${cls}`}>{value}</p>
      {subtext && <p className="text-[10px] text-brand-400 mt-0.5 font-mono">{subtext}</p>}
    </div>
  );
}
