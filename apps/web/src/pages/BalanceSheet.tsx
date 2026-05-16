/**
 * /reports/balance-sheet — Bilanço (Aktif/Pasif/Özsermaye).
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileBarChart2, Scale } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BalanceSheet {
  as_of: string;
  assets: {
    total: number;
    breakdown: Array<{ key: string; label: string; amount: number }>;
  };
  liabilities: {
    total: number;
    breakdown: Array<{ key: string; label: string; amount: number }>;
  };
  equity: number;
  balanced: boolean;
}

import { fmtTRYShort as fmtTRY } from '../lib/formatting';

export function BalanceSheetPage() {
  const active = useAuth((s) => s.active);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const q = useQuery({
    queryKey: ['balance-sheet', active.tenantSlug, active.aggregate, asOf],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: BalanceSheet }>(`/reports/balance-sheet?as_of=${asOf}`);
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
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Rapor</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Scale className="size-6" />
          Bilanço
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Seçilen tarihte varlık/borç/özsermaye anlık görüntü. Sayman'daki kayıtlardan hesaplanır
          (basit yaklaşım — kesin mali bilanço için muhasebe yazılımının raporunu kullan).
        </p>
      </header>

      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm">Snapshot tarihi:</label>
        <input
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-sm"
        />
        {q.data && (
          <span
            className={`ml-auto text-xs flex items-center gap-1 ${
              q.data.balanced ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {q.data.balanced && <CheckCircle2 className="size-3" />}
            Bilanço {q.data.balanced ? 'dengeli' : 'dengesiz'}
          </span>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-brand-500">Hesaplanıyor…</p>}

      {q.data && (
        <>
          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <KpiCard label="Toplam Varlık (Aktif)" value={q.data.assets.total} color="emerald" />
            <KpiCard label="Toplam Borç (Pasif)" value={q.data.liabilities.total} color="red" />
            <KpiCard label="Özsermaye" value={q.data.equity} color="purple" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <BalanceColumn
              title="AKTIFLER (Varlık)"
              total={q.data.assets.total}
              items={q.data.assets.breakdown}
              color="emerald"
            />
            <BalanceColumn
              title="PASIFLER (Borç + Özsermaye)"
              total={q.data.liabilities.total + q.data.equity}
              items={[
                ...q.data.liabilities.breakdown,
                { key: 'equity', label: 'Özsermaye', amount: q.data.equity },
              ]}
              color="red"
              equity={q.data.equity}
            />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'purple';
}) {
  const cls = {
    emerald: 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    red: 'bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    purple: 'bg-purple-50/40 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
  }[color];
  return (
    <div className={`card ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold font-mono mt-1`}>{fmtTRY(value)}</p>
    </div>
  );
}

function BalanceColumn({
  title,
  total,
  items,
  color,
  equity,
}: {
  title: string;
  total: number;
  items: Array<{ key: string; label: string; amount: number }>;
  color: 'emerald' | 'red';
  equity?: number;
}) {
  const headerColor = color === 'emerald' ? 'text-emerald-700' : 'text-red-700';
  return (
    <div className="card">
      <h3 className={`font-semibold mb-3 ${headerColor} uppercase tracking-wider text-xs`}>
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.key}
            className={`flex items-center justify-between py-1.5 border-b border-brand-50 dark:border-slate-800/50 ${
              it.key === 'equity' ? 'font-medium text-purple-700 dark:text-purple-400' : ''
            }`}
          >
            <span className="text-sm text-brand-700 dark:text-slate-300">{it.label}</span>
            <span className={`font-mono text-sm ${it.amount < 0 ? 'text-red-600' : ''}`}>
              {fmtTRY(it.amount)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t-2 border-brand-200 dark:border-slate-700 mt-3 pt-2 flex items-center justify-between">
        <span className={`text-sm font-semibold uppercase ${headerColor}`}>Toplam</span>
        <span className="font-mono font-bold text-brand-900 dark:text-slate-100">
          {fmtTRY(total)}
        </span>
      </div>
    </div>
  );
}
