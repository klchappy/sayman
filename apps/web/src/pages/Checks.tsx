/**
 * /checks — Çek ve senet takibi.
 *
 * İki yön (incoming/outgoing) × iki tür (çek/senet) tabbed görünüm.
 * State transitions: portfolio → deposited → cashed (incoming),
 * issued → cashed (outgoing), her ikisi → returned (kötü senaryo).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { SavedFilters } from '../components/SavedFilters';

interface Check {
  id: string;
  kind: 'check' | 'promissory_note';
  direction: 'incoming' | 'outgoing';
  document_no: string | null;
  drawer_name: string | null;
  beneficiary_name: string | null;
  bank_branch: string | null;
  amount: string;
  currency: string;
  issue_date: string | null;
  due_date: string;
  status: string;
  portfolio_no: string | null;
  deposited_at: string | null;
  cashed_at: string | null;
  returned_at: string | null;
  return_reason: string | null;
  notes: string | null;
  tenant_name?: string | null;
}

interface ChecksSummary {
  portfolio: { count: number; amount: number };
  deposited: { count: number; amount: number };
  outgoing_pending: { count: number; amount: number };
  due_next_30d: { count: number; amount: number };
  returned: { count: number; amount: number };
}

const STATUS_BADGE: Record<string, string> = {
  portfolio: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  deposited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cashed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  issued: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  returned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  bounced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-brand-100 text-brand-500 dark:bg-slate-800',
};

const STATUS_LABEL: Record<string, string> = {
  portfolio: 'Portföyde',
  deposited: 'Bankada',
  cashed: 'Tahsil',
  issued: 'Yazıldı',
  returned: 'Karşılıksız',
  bounced: 'İade',
  cancelled: 'İptal',
};

import { fmtTRY } from '../lib/formatting';

export function ChecksPage() {
  const active = useAuth((s) => s.active);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [showForm, setShowForm] = useState(false);

  const summary = useQuery({
    queryKey: ['checks-summary', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: ChecksSummary }>('/checks/summary');
      return res.data.data;
    },
  });

  const list = useQuery({
    queryKey: ['checks', active.tenantSlug, active.aggregate, tab],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: Check[] }>(`/checks?direction=${tab}`);
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
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Finans</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="size-6" />
            Çek ve Senet
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Aldığın ve yazdığın çek/senet portföyü. Vadesi yaklaşan kayıtlar için günlük uyarı.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SavedFilters module="checks" currentFilters={{ tab }} onApply={(f) => {
            if (f.tab === 'incoming' || f.tab === 'outgoing') setTab(f.tab);
          }} />
          <button
            onClick={() => setShowForm(true)}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="size-4" />
            Yeni Çek/Senet
          </button>
        </div>
      </header>

      {summary.data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi
            label="Portföyde (Bekleyen)"
            value={fmtTRY(summary.data.portfolio.amount)}
            sub={`${summary.data.portfolio.count} adet`}
            icon={<ArrowDownToLine className="size-4 text-blue-500" />}
          />
          <Kpi
            label="Bankada (Tahsile)"
            value={fmtTRY(summary.data.deposited.amount)}
            sub={`${summary.data.deposited.count} adet`}
            icon={<ArrowDownToLine className="size-4 text-amber-500" />}
          />
          <Kpi
            label="Çıkan (Ödenecek)"
            value={fmtTRY(summary.data.outgoing_pending.amount)}
            sub={`${summary.data.outgoing_pending.count} adet`}
            icon={<ArrowUpFromLine className="size-4 text-purple-500" />}
            highlight="amber"
          />
          <Kpi
            label="30 Gün Vade"
            value={fmtTRY(summary.data.due_next_30d.amount)}
            sub={`${summary.data.due_next_30d.count} adet`}
            icon={<AlertTriangle className="size-4 text-red-500" />}
            highlight={summary.data.due_next_30d.count > 0 ? 'red' : undefined}
          />
        </div>
      )}

      <div className="flex border-b border-brand-100 dark:border-slate-800 mb-4">
        <button
          onClick={() => setTab('incoming')}
          className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'incoming'
              ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          <ArrowDownToLine className="size-4" />
          Alacak (Bize Gelen)
        </button>
        <button
          onClick={() => setTab('outgoing')}
          className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'outgoing'
              ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
              : 'border-transparent text-brand-500 hover:text-brand-700'
          }`}
        >
          <ArrowUpFromLine className="size-4" />
          Borç (Bizim Yazdığımız)
        </button>
      </div>

      {showForm && (
        <CheckForm
          direction={tab}
          onClose={() => setShowForm(false)}
        />
      )}

      {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {list.data && list.data.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Bu kategoride henüz çek/senet yok.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Tür</th>
                <th className="py-2.5 px-3">Belge No</th>
                <th className="py-2.5 px-3">
                  {tab === 'incoming' ? 'Keşideci' : 'Lehtar'}
                </th>
                <th className="py-2.5 px-3">Banka</th>
                <th className="py-2.5 px-3 text-right">Tutar</th>
                <th className="py-2.5 px-3">Vade</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => (
                <CheckRow key={c.id} check={c} aggregate={!!active.aggregate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  highlight?: 'red' | 'amber';
}) {
  const cls =
    highlight === 'red'
      ? 'text-red-600'
      : highlight === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-brand-900 dark:text-slate-100';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-brand-500">{label}</span>
        {icon}
      </div>
      <p className={`text-xl font-semibold font-mono ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-brand-400 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

function CheckRow({ check, aggregate }: { check: Check; aggregate: boolean }) {
  const qc = useQueryClient();
  const [actionOpen, setActionOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);

  const today = new Date();
  const dueDate = new Date(check.due_date);
  const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / 86_400_000);
  const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 7;
  const isOverdue = daysUntilDue < 0;

  const action = useMutation({
    mutationFn: async (op: 'deposit' | 'cash' | 'return') => {
      const body = op === 'return' ? { return_reason: returnReason } : {};
      await api.post(`/checks/${check.id}/${op}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checks'] });
      qc.invalidateQueries({ queryKey: ['checks-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      setActionOpen(false);
      setShowReturn(false);
      setReturnReason('');
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'İşlem başarısız',
      );
    },
  });

  const counterpart = check.direction === 'incoming' ? check.drawer_name : check.beneficiary_name;

  return (
    <tr
      className={`border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30 ${
        isOverdue && ['portfolio', 'deposited', 'issued'].includes(check.status)
          ? 'bg-red-50/30 dark:bg-red-900/10'
          : isUrgent
            ? 'bg-amber-50/30 dark:bg-amber-900/10'
            : ''
      }`}
    >
      <td className="py-2 px-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{check.kind === 'check' ? 'Çek' : 'Senet'}</span>
          {aggregate && check.tenant_name && (
            <span className="text-[10px] uppercase tracking-wide bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
              {check.tenant_name}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 font-mono text-xs">{check.document_no ?? '-'}</td>
      <td className="py-2 px-3 text-brand-700 dark:text-slate-300">{counterpart ?? '-'}</td>
      <td className="py-2 px-3 text-xs text-brand-500">{check.bank_branch ?? '-'}</td>
      <td className="py-2 px-3 text-right font-mono font-semibold">{fmtTRY(check.amount)}</td>
      <td className="py-2 px-3 text-xs">
        <span className="font-mono">{check.due_date}</span>
        {isOverdue && ['portfolio', 'deposited', 'issued'].includes(check.status) && (
          <span className="block text-red-600 text-[10px]">{Math.abs(daysUntilDue)} gün geçti</span>
        )}
        {isUrgent && (
          <span className="block text-amber-700 text-[10px]">{daysUntilDue} gün kaldı</span>
        )}
      </td>
      <td className="py-2 px-3">
        <span className={`badge text-xs ${STATUS_BADGE[check.status]}`}>
          {STATUS_LABEL[check.status] ?? check.status}
        </span>
      </td>
      <td className="py-2 px-3">
        {(check.status === 'portfolio' ||
          check.status === 'deposited' ||
          check.status === 'issued') && (
          <div className="flex items-center gap-1">
            {check.direction === 'incoming' && check.status === 'portfolio' && (
              <button
                onClick={() => action.mutate('deposit')}
                disabled={action.isPending}
                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded"
                title="Bankaya yatır"
              >
                Yatır
              </button>
            )}
            <button
              onClick={() => action.mutate('cash')}
              disabled={action.isPending}
              className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded flex items-center gap-1"
              title="Tahsil edildi"
            >
              <CheckCircle2 className="size-3" />
              Tahsil
            </button>
            <button
              onClick={() => setShowReturn(true)}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded flex items-center gap-1"
              title="Karşılıksız döndü"
            >
              <XCircle className="size-3" />
              İade
            </button>
          </div>
        )}
        {showReturn && (
          <div className="mt-2 flex items-center gap-1">
            <input
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Red sebebi..."
              className="text-xs rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-0.5"
            />
            <button
              onClick={() => action.mutate('return')}
              disabled={action.isPending || returnReason.length < 2}
              className="text-xs bg-red-600 text-white px-2 py-0.5 rounded disabled:opacity-50"
            >
              ✓
            </button>
            <button
              onClick={() => {
                setShowReturn(false);
                setReturnReason('');
              }}
              className="text-xs text-brand-500"
            >
              ✕
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CheckForm({
  direction,
  onClose,
}: {
  direction: 'incoming' | 'outgoing';
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'check' | 'promissory_note'>('check');
  const [documentNo, setDocumentNo] = useState('');
  const [counterpart, setCounterpart] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        kind,
        direction,
        document_no: documentNo || null,
        drawer_name: direction === 'incoming' ? counterpart : null,
        beneficiary_name: direction === 'outgoing' ? counterpart : null,
        bank_branch: bankBranch || null,
        amount,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || null,
      };
      await api.post('/checks', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checks'] });
      qc.invalidateQueries({ queryKey: ['checks-summary'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Kayıt başarısız',
      );
    },
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">
          Yeni {direction === 'incoming' ? 'Gelen' : 'Çıkan'} Çek/Senet
        </h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="check">Çek</option>
          <option value="promissory_note">Senet (Bono)</option>
        </select>
        <input
          value={documentNo}
          onChange={(e) => setDocumentNo(e.target.value)}
          placeholder="Belge no (seri no)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={counterpart}
          onChange={(e) => setCounterpart(e.target.value)}
          placeholder={direction === 'incoming' ? 'Keşideci adı' : 'Lehtar adı'}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          value={bankBranch}
          onChange={(e) => setBankBranch(e.target.value)}
          placeholder="Banka şubesi (opsiyonel)"
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
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Düzenleme
          <input
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            type="date"
            className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Vade *
          <input
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            type="date"
            className="mt-1 w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
          />
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Not"
          rows={2}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm sm:col-span-2"
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
            if (!amount) return setError('Tutar zorunlu');
            if (!dueDate) return setError('Vade tarihi zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Kaydet
        </button>
      </div>
    </div>
  );
}
