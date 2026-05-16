/**
 * /cari/:id/reconciliation — bir cari için mutabakat ekranı.
 *
 * Sayman'da olan ödeme + ERP'den gelen movement satır satır eşleştirilir.
 * Eşleşmeyenler ayrı bölümde — kullanıcı manuel araştırır veya yok sayar.
 */
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle,
  Database,
  Loader2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface MatchRow {
  source: 'sayman' | 'erp';
  id: string;
  date: string;
  amount: number;
  description: string;
  matched_with_id: string | null;
  confidence: number;
}

interface ReconcResponse {
  cari: { id: string; name: string };
  stats: {
    sayman_total: number;
    sayman_matched: number;
    sayman_unmatched: number;
    erp_total: number;
    erp_unmatched: number;
  };
  sayman_payments: MatchRow[];
  erp_movements_unmatched: MatchRow[];
}

import { fmtTRY } from '../lib/formatting';

export function ReconciliationPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['reconciliation', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: ReconcResponse }>(`/reconciliation/cari/${id}`);
      return res.data.data;
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="p-8 flex items-center gap-2 text-brand-500">
        <Loader2 className="size-4 animate-spin" />
        Mutabakat hesaplanıyor…
      </div>
    );
  }

  const { stats, cari, sayman_payments, erp_movements_unmatched } = q.data;
  const matchRate =
    stats.sayman_total > 0 ? (stats.sayman_matched / stats.sayman_total) * 100 : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        to={`/cari/${cari.id}`}
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 dark:text-slate-400 mb-4"
      >
        <ArrowLeft className="size-4" />
        Cari detayı
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Mutabakat</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="size-6" />
          {cari.name}
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Sayman'daki ödemeler ile ERP'den gelen cari ekstresi eşleştirildi.
        </p>
      </header>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="card">
          <p className="text-[10px] uppercase tracking-wide text-brand-500">Sayman Ödeme</p>
          <p className="text-xl font-semibold font-mono mt-1">{stats.sayman_total}</p>
        </div>
        <div className="card bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700">Eşleşen</p>
          <p className="text-xl font-semibold font-mono mt-1 text-emerald-700 dark:text-emerald-400">
            {stats.sayman_matched}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5 font-mono">%{matchRate.toFixed(0)}</p>
        </div>
        <div className="card bg-amber-50/40 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
          <p className="text-[10px] uppercase tracking-wide text-amber-700">Sayman'da Sadece</p>
          <p className="text-xl font-semibold font-mono mt-1 text-amber-700 dark:text-amber-400">
            {stats.sayman_unmatched}
          </p>
        </div>
        <div className="card bg-purple-50/40 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
          <p className="text-[10px] uppercase tracking-wide text-purple-700">ERP'de Sadece</p>
          <p className="text-xl font-semibold font-mono mt-1 text-purple-700 dark:text-purple-400">
            {stats.erp_unmatched}
          </p>
        </div>
      </div>

      {/* Sayman tarafı */}
      <section className="card mb-6 p-0">
        <div className="px-4 py-3 border-b border-brand-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900 dark:text-slate-100">
            Sayman Ödemeleri (eşleşme durumu)
          </h2>
          <span className="text-xs text-brand-500 dark:text-slate-400">
            {sayman_payments.length} kayıt
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800 bg-brand-50/50 dark:bg-slate-800/30">
              <th className="py-2 px-3">Tarih</th>
              <th className="py-2 px-3">Açıklama</th>
              <th className="py-2 px-3 text-right">Tutar</th>
              <th className="py-2 px-3">Eşleşme</th>
              <th className="py-2 px-3 text-right">Güven</th>
            </tr>
          </thead>
          <tbody>
            {sayman_payments.map((row) => (
              <tr
                key={row.id}
                className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30"
              >
                <td className="py-2 px-3 font-mono text-xs">{row.date}</td>
                <td className="py-2 px-3 text-brand-700 dark:text-slate-300">{row.description}</td>
                <td className="py-2 px-3 text-right font-mono">{fmtTRY(row.amount)}</td>
                <td className="py-2 px-3">
                  {row.matched_with_id ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="size-3" />
                      ERP eşleşti
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      ERP'de yok
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-xs font-mono">
                  {row.confidence > 0 ? `%${(row.confidence * 100).toFixed(0)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ERP'de eşleşmemiş */}
      {erp_movements_unmatched.length > 0 && (
        <section className="card p-0">
          <div className="px-4 py-3 border-b border-brand-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="size-4" />
              ERP'de var, Sayman'da yok
            </h2>
            <span className="text-xs text-brand-500 dark:text-slate-400">
              {erp_movements_unmatched.length} kayıt
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800 bg-brand-50/50 dark:bg-slate-800/30">
                <th className="py-2 px-3">Tarih</th>
                <th className="py-2 px-3">Açıklama</th>
                <th className="py-2 px-3 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {erp_movements_unmatched.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-purple-50/30 dark:hover:bg-purple-900/10"
                >
                  <td className="py-2 px-3 font-mono text-xs">{row.date}</td>
                  <td className="py-2 px-3 text-brand-700 dark:text-slate-300">{row.description}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtTRY(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
