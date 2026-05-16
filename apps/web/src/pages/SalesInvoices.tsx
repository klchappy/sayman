/**
 * /sales-invoices — Satış faturaları (alacak/gelir tarafı).
 *
 * Sayman'da kestiğin/alacaklı olduğun faturalar.
 * ERP ile çift yönlü: Paraşüt'ten pull, manuel kayıt + push.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpRight,
  Brain,
  Coins,
  FileSpreadsheet,
  Loader2,
  Phone,
  Plus,
  Receipt,
  Send,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuditHistoryButton } from '../components/AuditHistoryButton';
import { PendingReviewBanner, PendingReviewEmptyHint } from '../components/PendingReviewBanner';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { QuickInvoiceUploadButton } from '../components/QuickInvoiceUploadButton';
import { SavedFilters } from '../components/SavedFilters';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface SalesInvoice {
  id: string;
  title: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount: string;
  paid_amount: string;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  status: 'draft' | 'sent' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled';
  erp_push_status: string | null;
  erp_external_id: string | null;
  auto_created_source: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  metadata?: Record<string, unknown> | null;
  tenant_name?: string | null;
}

interface SalesSummary {
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  collected_this_month: number;
  invoice_count: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  sent: 'Gönderildi',
  partial_paid: 'Kısmi Tahsil',
  paid: 'Tahsil Edildi',
  overdue: 'Geciken',
  cancelled: 'İptal',
};

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  partial_paid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  draft: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-brand-100 text-brand-500',
};

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

export function SalesInvoicesPage() {
  const active = useAuth((s) => s.active);
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['sales-invoices', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: SalesInvoice[] }>('/sales-invoices');
      return res.data.data;
    },
  });

  const summary = useQuery({
    queryKey: ['sales-summary', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: SalesSummary }>('/sales-invoices/summary');
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Alacak / Gelir</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Coins className="size-6" />
            Satış Faturaları
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Kestiğin / alacaklı olduğun faturalar. ERP'den otomatik gelir, Sayman'da manuel
            kaydedebilir veya geri push edebilirsin.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SavedFilters module="sales-invoices" currentFilters={{}} onApply={() => {}} />
          <AICollectionStrategyButton />
          <QuickInvoiceUploadButton label="Dosya Yükle" />
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="size-4" />
            Yeni Satış Faturası
          </button>
        </div>
      </header>

      {/* KPI özet */}
      {summary.data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Toplam Alacak"
            value={fmtTRY(summary.data.outstanding)}
            sub={`${summary.data.invoice_count} fatura`}
            icon={<TrendingUp className="size-4 text-brand-300" />}
          />
          <Kpi
            label="Geciken Tahsilat"
            value={fmtTRY(summary.data.overdue_amount)}
            sub={`${summary.data.overdue_count} fatura`}
            icon={<AlertCircle className="size-4 text-red-500" />}
            highlight={summary.data.overdue_count > 0 ? 'red' : undefined}
          />
          <Kpi
            label="Bu Ay Tahsil"
            value={fmtTRY(summary.data.collected_this_month)}
            icon={<ArrowUpRight className="size-4 text-emerald-500" />}
            highlight="emerald"
          />
          <Kpi
            label="Toplam Tahsil"
            value={fmtTRY(summary.data.paid_amount)}
            sub={fmtTRY(summary.data.total_amount) + ' brüt'}
            icon={<Receipt className="size-4 text-brand-300" />}
          />
        </div>
      )}

      {showForm && <SalesForm onClose={() => setShowForm(false)} />}

      <PendingReviewBanner type="sales_invoices" />

      <div className="card overflow-x-auto p-0">
        {list.isLoading && <p className="text-brand-500 text-sm p-4">Yükleniyor…</p>}
        {list.data && list.data.length === 0 && (
          <div className="text-center py-12">
            <Coins className="size-12 mx-auto text-brand-300 mb-2" />
            <p className="text-brand-700 dark:text-slate-300 font-medium">
              Henüz satış faturası yok.
            </p>
            <PendingReviewEmptyHint type="sales_invoices" />
          </div>
        )}
        {list.data && list.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Başlık</th>
                <th className="py-2.5 px-3">Müşteri</th>
                <th className="py-2.5 px-3">Fatura No</th>
                <th className="py-2.5 px-3">Vade</th>
                <th className="py-2.5 px-3 text-right">Tutar</th>
                <th className="py-2.5 px-3 text-right">Tahsil</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="py-2 px-3 font-medium text-brand-900 dark:text-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{s.title}</span>
                      {active.aggregate && s.tenant_name && (
                        <span className="text-[10px] uppercase tracking-wide bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          {s.tenant_name}
                        </span>
                      )}
                      <ProvenanceBadge item={s} />
                      {s.erp_push_status === 'pushed' && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded uppercase">
                          ERP↑
                        </span>
                      )}
                      {s.erp_push_status === 'pulled' && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded uppercase">
                          ERP↓
                        </span>
                      )}
                      <AuditHistoryButton targetTable="sales_invoices" targetId={s.id} />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-brand-700 dark:text-slate-300">
                    {s.customer_name ?? '-'}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{s.invoice_number ?? '-'}</td>
                  <td className="py-2 px-3 text-xs">{s.due_date ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtTRY(s.amount)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {fmtTRY(s.paid_amount)}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`badge ${STATUS_BADGE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <SalesPushButton invoice={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  highlight?: 'red' | 'emerald';
}) {
  const cls =
    highlight === 'red'
      ? 'text-red-600 dark:text-red-400'
      : highlight === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-brand-900 dark:text-slate-100';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-brand-500 dark:text-slate-400">
          {label}
        </span>
        {icon}
      </div>
      <p className={`text-xl font-semibold font-mono ${cls}`}>{value}</p>
      {sub && (
        <p className="text-[10px] text-brand-400 dark:text-slate-500 mt-0.5 font-mono">{sub}</p>
      )}
    </div>
  );
}

function SalesForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/sales-invoices', {
        title,
        customer_name: customerName || null,
        invoice_number: invoiceNo || null,
        amount,
        issue_date: issueDate || null,
        due_date: dueDate || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-invoices'] });
      qc.invalidateQueries({ queryKey: ['sales-summary'] });
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Satış Faturası</h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Başlık * (örn: ABC Şirket Mart Hizmet)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Müşteri adı"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="Fatura no"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Tutar (TL) *"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          type="date"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          type="date"
          placeholder="Vade tarihi"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => {
            setError(null);
            if (title.length < 2) return setError('Başlık zorunlu');
            if (!amount) return setError('Tutar zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
        >
          {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}

interface ErpConnectionMini {
  id: string;
  name: string;
  provider: string;
  status: string;
}

function SalesPushButton({ invoice }: { invoice: SalesInvoice }) {
  const qc = useQueryClient();
  const conns = useQuery({
    queryKey: ['erp-connections-list'],
    queryFn: async () => {
      const res = await api.get<{ data: ErpConnectionMini[] }>('/erp/connections');
      return res.data.data.filter((c) => c.status === 'active');
    },
  });

  const push = useMutation({
    mutationFn: async (connId: string) => {
      await api.post(`/sales-invoices/${invoice.id}/push/${connId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-invoices'] }),
  });

  if (invoice.erp_push_status === 'pushed') {
    return (
      <span
        className="text-xs text-emerald-700 dark:text-emerald-400"
        title={`ERP ID: ${invoice.erp_external_id}`}
      >
        ✓
      </span>
    );
  }
  if (!conns.data || conns.data.length === 0) return null;

  return (
    <select
      onChange={(e) => {
        if (e.target.value) push.mutate(e.target.value);
        e.target.value = '';
      }}
      className="text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-2 py-1 border border-blue-200 dark:border-blue-800"
      disabled={push.isPending}
      value=""
    >
      <option value="">
        {push.isPending ? '…' : 'Push'}
      </option>
      {conns.data.map((c) => (
        <option key={c.id} value={c.id}>
          → {c.name}
        </option>
      ))}
    </select>
  );
}

interface CollectionSuggestion {
  invoice_id: string;
  customer_name: string | null;
  outstanding: number;
  days_overdue: number;
  priority: string;
  recommended_channel: string;
  reasoning: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  whatsapp: Send,
  email: Send,
  legal: AlertCircle,
};

function AICollectionStrategyButton() {
  const [showModal, setShowModal] = useState(false);
  const [strategy, setStrategy] = useState<{
    method: string;
    summary: string;
    suggestions: CollectionSuggestion[];
  } | null>(null);

  const ask = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        data: {
          method: string;
          summary: string;
          suggestions: CollectionSuggestion[];
        };
      }>('/sales-invoices/ai-collection-strategy');
      return res.data.data;
    },
    onSuccess: (data) => {
      setStrategy(data);
      setShowModal(true);
    },
  });

  return (
    <>
      <button
        onClick={() => ask.mutate()}
        disabled={ask.isPending}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
      >
        {ask.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Brain className="size-4" />
        )}
        AI Tahsilat Stratejisi
      </button>
      {showModal && strategy && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
                <Brain className="size-5 text-purple-600" />
                Tahsilat Stratejisi (
                {strategy.method === 'claude' ? 'Claude AI' : 'Kural-tabanlı'})
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
              >
                <X className="size-5" />
              </button>
            </div>
            {strategy.summary && (
              <p className="text-sm text-brand-700 dark:text-slate-300 bg-purple-50 dark:bg-purple-900/20 rounded p-3 mb-4">
                {strategy.summary}
              </p>
            )}
            {strategy.suggestions.length === 0 ? (
              <p className="text-center text-brand-500 py-6">Geciken alacak yok.</p>
            ) : (
              <div className="space-y-2">
                {strategy.suggestions.map((s) => {
                  const ChannelIcon = CHANNEL_ICON[s.recommended_channel] ?? Send;
                  return (
                    <div
                      key={s.invoice_id}
                      className="border border-brand-100 dark:border-slate-800 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-medium ${PRIORITY_COLOR[s.priority] ?? PRIORITY_COLOR.low}`}
                          >
                            {s.priority === 'high'
                              ? 'Yüksek'
                              : s.priority === 'medium'
                                ? 'Orta'
                                : 'Düşük'}
                          </span>
                          <span className="font-medium text-brand-900 dark:text-slate-100">
                            {s.customer_name ?? '?'}
                          </span>
                          <span className="text-xs text-brand-500 font-mono">
                            {s.days_overdue} gün
                          </span>
                          <Link
                            to={`/sales-invoices/${s.invoice_id}`}
                            className="text-xs text-brand-600 hover:text-brand-900"
                          >
                            (fatura →)
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {fmtTRY(s.outstanding)}
                          </span>
                          <span className="text-xs flex items-center gap-1 bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-2 py-0.5 rounded">
                            <ChannelIcon className="size-3" />
                            {s.recommended_channel}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-brand-600 dark:text-slate-400">{s.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
