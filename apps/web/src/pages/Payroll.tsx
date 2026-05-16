/**
 * /payroll — Aylık maaş bordrosu.
 *
 * Liste + yeni dönem oluşturma + detay (her personel bordrosu).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface PayrollRun {
  id: string;
  period: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  total_gross: string;
  total_net: string;
  total_sgk: string;
  total_tax: string;
  total_employer_cost: string;
  employee_count: string;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PayrollItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_position: string | null;
  gross: string;
  sgk_employee: string;
  unemployment_employee: string;
  income_tax: string;
  stamp_tax: string;
  agi: string;
  net: string;
  sgk_employer: string;
  total_employer_cost: string;
  breakdown: { income_tax_bracket?: string };
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  approved: 'Onaylandı',
  paid: 'Ödendi',
  cancelled: 'İptal',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-slate-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

import { fmtTRY } from '../lib/formatting';

function currentMonthPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PayrollPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [period, setPeriod] = useState(currentMonthPeriod());
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['payroll-runs', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: PayrollRun[] }>('/payroll/runs');
      return res.data.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: PayrollRun }>('/payroll/runs', { period });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      setCreating(false);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Bordro oluşturulamadı',
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/payroll/runs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Silme işlemi başarısız',
      );
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
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">İK / Bordro</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="size-6" />
            Maaş Bordrosu
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Aylık bordrolar — brüt'ten net, SGK işçi/işveren, gelir vergisi, AGİ otomatik
            hesaplanır.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Dönem
        </button>
      </header>

      {creating && (
        <div className="card mb-4 border-brand-300 dark:border-slate-700">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm">Dönem:</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Hesapla ve Oluştur
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded"
            >
              İptal
            </button>
          </div>
          {create.error && (
            <p className="text-sm text-red-600 mt-2">{(create.error as Error).message}</p>
          )}
          <p className="text-[10px] text-brand-400 mt-2">
            Tüm aktif personel için otomatik bordro hesaplanır. Aynı dönem için yeniden çalıştırılamaz.
          </p>
        </div>
      )}

      {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {list.data && list.data.length === 0 && !creating && (
        <div className="card text-center py-12">
          <Receipt className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Henüz bordro çalıştırılmadı.
          </p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Önce <Link to="/employees" className="text-brand-700 underline">personel listesi</Link>{' '}
            doldur, sonra ilk dönemi oluştur.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Dönem</th>
                <th className="py-2.5 px-3 text-right">Personel</th>
                <th className="py-2.5 px-3 text-right">Brüt Toplam</th>
                <th className="py-2.5 px-3 text-right">Net Toplam</th>
                <th className="py-2.5 px-3 text-right">İşv. Maliyet</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
                >
                  <td className="py-2 px-3 font-mono">
                    <Link
                      to={`/payroll/${r.id}`}
                      className="text-brand-900 dark:text-slate-100 hover:text-brand-700 font-medium"
                    >
                      {r.period}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-right">{r.employee_count}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtTRY(r.total_gross)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    {fmtTRY(r.total_net)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {fmtTRY(r.total_employer_cost)}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`badge text-xs ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {r.status === 'draft' && (
                      <button
                        onClick={() => {
                          if (confirm(`${r.period} bordrosu silinsin mi?`)) remove.mutate(r.id);
                        }}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
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

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['payroll-run', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: PayrollRun & { items: PayrollItem[] } }>(
        `/payroll/runs/${id}`,
      );
      return res.data.data;
    },
  });

  const approve = useMutation({
    mutationFn: async () => api.post(`/payroll/runs/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-run', id] });
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      setActionError(null);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setActionError(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Onaylama başarısız',
      );
    },
  });

  const markPaid = useMutation({
    mutationFn: async () => api.post(`/payroll/runs/${id}/mark-paid`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-run', id] });
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      setActionError(null);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setActionError(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Ödendi işaretleme başarısız',
      );
    },
  });

  if (q.isLoading || !q.data) {
    return <div className="p-8 text-brand-500">Yükleniyor…</div>;
  }

  const run = q.data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link
        to="/payroll"
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 dark:text-slate-400 mb-4"
      >
        <ArrowLeft className="size-4" />
        Bordrolar
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Bordro</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 font-mono">
            {run.period}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge text-xs ${STATUS_BADGE[run.status]}`}>
              {STATUS_LABEL[run.status]}
            </span>
            <span className="text-sm text-brand-500 dark:text-slate-400">
              {run.employee_count} personel
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'draft' && (
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              Onayla
            </button>
          )}
          {run.status === 'approved' && (
            <button
              onClick={() => markPaid.mutate()}
              disabled={markPaid.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              Ödendi İşaretle
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-900 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-red-600 dark:text-red-300 text-xs hover:underline"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Toplamlar */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Brüt Toplam" value={fmtTRY(run.total_gross)} />
        <Kpi
          label="Net (Ödenecek)"
          value={fmtTRY(run.total_net)}
          highlight="emerald"
        />
        <Kpi
          label="SGK Toplam"
          value={fmtTRY(run.total_sgk)}
          highlight="amber"
        />
        <Kpi
          label="İşveren Maliyeti"
          value={fmtTRY(run.total_employer_cost)}
          highlight="red"
        />
      </div>

      {/* Items table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
              <th className="py-2.5 px-3">Personel</th>
              <th className="py-2.5 px-3 text-right">Brüt</th>
              <th className="py-2.5 px-3 text-right">SGK İşçi</th>
              <th className="py-2.5 px-3 text-right">İşsizlik</th>
              <th className="py-2.5 px-3 text-right">GV</th>
              <th className="py-2.5 px-3 text-right">Damga</th>
              <th className="py-2.5 px-3 text-right">AGİ</th>
              <th className="py-2.5 px-3 text-right">Net</th>
              <th className="py-2.5 px-3 text-right">İşv. Maliyet</th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {run.items.map((it) => (
              <tr
                key={it.id}
                className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
              >
                <td className="py-2 px-3 font-medium">
                  {it.employee_name}
                  {it.employee_position && (
                    <p className="text-[10px] text-brand-400">{it.employee_position}</p>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono">{fmtTRY(it.gross)}</td>
                <td className="py-2 px-3 text-right font-mono text-red-600 text-xs">
                  -{fmtTRY(it.sgk_employee)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-red-600 text-xs">
                  -{fmtTRY(it.unemployment_employee)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-red-600 text-xs">
                  <div>-{fmtTRY(it.income_tax)}</div>
                  {it.breakdown?.income_tax_bracket && (
                    <span className="text-[9px] text-brand-400">
                      ({it.breakdown.income_tax_bracket})
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono text-red-600 text-xs">
                  -{fmtTRY(it.stamp_tax)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-700 text-xs">
                  +{fmtTRY(it.agi)}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {fmtTRY(it.net)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                  {fmtTRY(it.total_employer_cost)}
                </td>
                <td className="py-2 px-3">
                  <button
                    onClick={async () => {
                      const r = await api.get<Blob>(
                        `/payroll/runs/${run.id}/items/${it.id}/pdf`,
                        { responseType: 'blob' },
                      );
                      const url = URL.createObjectURL(r.data);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `bordro-${it.employee_name.replace(/[^a-z0-9]/gi, '_')}-${run.period}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-brand-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 px-2 py-1 rounded flex items-center gap-1"
                    title="Maaş pusulası PDF"
                  >
                    <FileDown className="size-3" />
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'emerald' | 'amber' | 'red';
}) {
  const cls =
    highlight === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : highlight === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : highlight === 'red'
          ? 'text-red-600 dark:text-red-400'
          : 'text-brand-900 dark:text-slate-100';
  return (
    <div className="card">
      <p className="text-[10px] uppercase tracking-wide text-brand-500">{label}</p>
      <p className={`text-xl font-semibold font-mono mt-1 ${cls}`}>{value}</p>
    </div>
  );
}
