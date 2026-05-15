/**
 * /budgets — Kategori bazlı bütçe planlama + gerçekleşen karşılaştırma.
 *
 * Kullanıcı her kategori için aylık (veya quarterly/yearly) bütçe belirler.
 * Tablo gerçekleşeni gösterir, ilerleme çubuğu ile aşılmayı vurgular.
 * Cron her gün 08:00'da threshold geçince uyarı yollar.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_LABELS, PAYABLE_CATEGORIES, type PayableCategory } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BudgetWithActual {
  id: string;
  category: string;
  category_label: string;
  period_kind: 'monthly' | 'quarterly' | 'yearly';
  period: string;
  planned_amount: string;
  currency: string;
  alert_threshold_pct: string;
  actual_amount: number;
  usage_pct: number;
  over_budget: boolean;
  notes: string | null;
}

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

function currentMonthPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function BudgetsPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [period, setPeriod] = useState(currentMonthPeriod());
  const [showForm, setShowForm] = useState(false);

  const list = useQuery({
    queryKey: ['budgets', active.tenantSlug, period],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: BudgetWithActual[] }>(`/budgets?period=${period}`);
      return res.data.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
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

  const totals = (list.data ?? []).reduce(
    (acc, b) => {
      acc.planned += Number(b.planned_amount);
      acc.actual += b.actual_amount;
      return acc;
    },
    { planned: 0, actual: 0 },
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Planlama</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Target className="size-6" />
            Bütçe Planlama
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Her kategori için aylık bütçe planla. Eşik aşılınca otomatik uyarı alırsın.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Bütçe
        </button>
      </header>

      {/* Dönem seçici */}
      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm text-brand-700 dark:text-slate-300">Dönem:</label>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-sm"
        />
        {totals.planned > 0 && (
          <div className="ml-auto text-sm text-brand-600 dark:text-slate-400">
            Toplam plan:{' '}
            <strong className="font-mono text-brand-900 dark:text-slate-100">
              {fmtTRY(totals.planned)}
            </strong>{' '}
            · Gerçek:{' '}
            <strong
              className={`font-mono ${
                totals.actual > totals.planned
                  ? 'text-red-600'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {fmtTRY(totals.actual)}
            </strong>
          </div>
        )}
      </div>

      {showForm && (
        <BudgetForm period={period} onClose={() => setShowForm(false)} />
      )}

      {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {list.data && list.data.length === 0 && (
        <div className="card text-center py-12">
          <Target className="size-12 mx-auto text-brand-300 mb-3" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Bu dönem için bütçe tanımlanmamış.
          </p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Yeni bütçe ekleyince gerçekleşen tutarla karşılaştırma başlar.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="space-y-3">
          {list.data.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              onDelete={() => {
                if (confirm(`"${b.category_label}" bütçesi silinsin mi?`)) remove.mutate(b.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetCard({
  budget,
  onDelete,
}: {
  budget: BudgetWithActual;
  onDelete: () => void;
}) {
  const planned = Number(budget.planned_amount);
  const actual = budget.actual_amount;
  const usagePct = Math.min(budget.usage_pct, 200); // bar'ı sınırlı tut

  const barColor = budget.over_budget
    ? 'bg-red-500'
    : usagePct >= Number(budget.alert_threshold_pct)
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div
      className={`card ${
        budget.over_budget
          ? 'border-red-200 bg-red-50/40 dark:bg-red-900/10 dark:border-red-800'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          {budget.over_budget && <AlertCircle className="size-4 text-red-600" />}
          <h3 className="font-semibold text-brand-900 dark:text-slate-100">
            {budget.category_label}
          </h3>
          <span className="text-xs text-brand-500 dark:text-slate-400 font-mono">
            {budget.period} · {budget.period_kind}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* İlerleme bar */}
      <div className="relative h-2 bg-brand-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.min(usagePct, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-brand-600 dark:text-slate-400">
            Plan: <strong className="font-mono text-brand-900 dark:text-slate-100">{fmtTRY(planned)}</strong>
          </span>
          <span className="text-brand-600 dark:text-slate-400">
            Gerçek:{' '}
            <strong
              className={`font-mono ${
                budget.over_budget
                  ? 'text-red-600'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {fmtTRY(actual)}
            </strong>
          </span>
          <span className="text-brand-600 dark:text-slate-400">
            Kalan:{' '}
            <strong className="font-mono">
              {fmtTRY(planned - actual)}
            </strong>
          </span>
        </div>
        <span
          className={`text-sm font-mono font-semibold ${
            budget.over_budget
              ? 'text-red-600'
              : usagePct >= Number(budget.alert_threshold_pct)
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          %{budget.usage_pct}
        </span>
      </div>
    </div>
  );
}

function BudgetForm({ period, onClose }: { period: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<PayableCategory>('elektrik');
  const [periodKind, setPeriodKind] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [periodValue, setPeriodValue] = useState(period);
  const [planned, setPlanned] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/budgets', {
        category,
        period_kind: periodKind,
        period: periodValue,
        planned_amount: planned,
        alert_threshold_pct: threshold,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? (e as Error).message);
    },
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Bütçe</h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PayableCategory)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          {PAYABLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={periodKind}
          onChange={(e) => setPeriodKind(e.target.value as typeof periodKind)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="monthly">Aylık</option>
          <option value="quarterly">Üç Aylık</option>
          <option value="yearly">Yıllık</option>
        </select>
        <input
          value={periodValue}
          onChange={(e) => setPeriodValue(e.target.value)}
          placeholder={
            periodKind === 'monthly'
              ? '2026-05'
              : periodKind === 'quarterly'
                ? '2026-Q2'
                : '2026'
          }
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm font-mono"
        />
        <input
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Planlanan tutar (TL)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <label className="text-xs text-brand-500 dark:text-slate-400 sm:col-span-2">
          Uyarı eşiği (%): {threshold}
          <input
            type="range"
            min={50}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full"
          />
        </label>
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
            if (!planned) return setError('Planlanan tutar zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          <CheckCircle2 className="size-3" />
          Kaydet
        </button>
      </div>
    </div>
  );
}
