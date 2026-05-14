import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Coins, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PAYABLE_STATUSES, type PayableStatus } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Payable {
  id: string;
  title: string;
  amount: string;
  paid_amount: string;
  status: PayableStatus;
  due_date: string | null;
  period_label: string | null;
  invoice_number: string | null;
}

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

const statusLabel: Record<PayableStatus, string> = {
  draft: 'Taslak',
  pending: 'Bekliyor',
  approaching: 'Yaklaşıyor',
  overdue: 'Geciken',
  partial_paid: 'Kısmi',
  paid: 'Ödendi',
  cancelled: 'İptal',
  archived: 'Arşiv',
  needs_review: 'Kontrol',
  waiting_approval: 'Onay Bek.',
};

const statusBadge: Record<PayableStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial_paid: 'bg-amber-100 text-amber-700',
  pending: 'bg-blue-100 text-blue-700',
  approaching: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  draft: 'bg-brand-100 text-brand-700',
  cancelled: 'bg-brand-100 text-brand-500',
  archived: 'bg-brand-100 text-brand-500',
  needs_review: 'bg-amber-100 text-amber-700',
  waiting_approval: 'bg-blue-100 text-blue-700',
};

export function DashboardPage() {
  const active = useAuth((s) => s.active);

  const payablesQuery = useQuery({
    queryKey: ['payables', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Payable[] }>('/payables');
      return res.data.data;
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşedeki seçiciden bir sektör (tenant) seç → Fatura/Ödeme verilerini gör.
          </p>
        </div>
      </div>
    );
  }

  const items = payablesQuery.data ?? [];
  const total = items.reduce((s, p) => s + Number(p.amount), 0);
  const paid = items.reduce((s, p) => s + Number(p.paid_amount), 0);
  const open = total - paid;
  const overdueCount = items.filter((p) => p.status === 'overdue').length;
  const upcoming = items.filter((p) => p.status === 'approaching' || p.status === 'pending').slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
          {active.orgSlug} / {active.tenantSlug}
        </p>
        <h1 className="text-2xl font-semibold text-brand-900">Operasyon Dashboard</h1>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-500 uppercase">Toplam Fatura</span>
            <FileText className="size-4 text-brand-300" />
          </div>
          <p className="text-2xl font-semibold text-brand-900">{items.length}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-500 uppercase">Toplam Tutar</span>
            <Coins className="size-4 text-brand-300" />
          </div>
          <p className="text-xl font-semibold text-brand-900 font-mono">{fmtTRY(total)}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-500 uppercase">Açık Bakiye</span>
            <Clock className="size-4 text-amber-400" />
          </div>
          <p className="text-xl font-semibold text-amber-700 font-mono">{fmtTRY(open)}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-brand-500 uppercase">Geciken</span>
            <AlertCircle className="size-4 text-red-400" />
          </div>
          <p className="text-2xl font-semibold text-red-600">{overdueCount}</p>
        </div>
      </div>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brand-900">Yaklaşan Faturalar</h2>
          <Link to="/payables" className="text-xs text-brand-600 hover:text-brand-900">
            Tümü →
          </Link>
        </div>
        {payablesQuery.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {upcoming.length === 0 && !payablesQuery.isLoading && (
          <p className="text-sm text-brand-500">Yaklaşan fatura yok.</p>
        )}
        <ul className="divide-y divide-brand-100">
          {upcoming.map((p) => (
            <li key={p.id} className="py-3 flex items-center justify-between">
              <div>
                <Link to={`/payables/${p.id}`} className="font-medium text-brand-900 hover:text-brand-700">
                  {p.title}
                </Link>
                <p className="text-xs text-brand-500">
                  {p.invoice_number ? `#${p.invoice_number} · ` : ''}
                  {p.period_label ? `${p.period_label} · ` : ''}
                  Vade: {p.due_date ?? '-'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-brand-900">{fmtTRY(p.amount)}</p>
                <span className={`badge ${statusBadge[p.status] ?? ''}`}>{statusLabel[p.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
