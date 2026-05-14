/**
 * /payment-approvals — Bekleyen + karar verilmiş yüksek tutarlı ödeme onayları.
 *
 * Org admin görür: pending listesi + approve/reject butonları
 * Self-approval engellendi (görevler ayrılığı).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ApprovalRow {
  id: string;
  payable_id: string;
  payable_title: string | null;
  supplier_name: string | null;
  requested_by_user_id: string;
  approver_user_id: string | null;
  amount: string;
  currency: string;
  method: string;
  reference_no: string | null;
  paid_at: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-slate-400',
};

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

export function PaymentApprovalsPage() {
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['payment-approvals', tab],
    queryFn: async () => {
      const res = await api.get<{ data: ApprovalRow[] }>(`/payment-approvals?status=${tab}`);
      return res.data.data;
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => api.post(`/payment-approvals/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-approvals'] }),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/payment-approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-approvals'] });
      setRejectModal(null);
      setReason('');
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => api.post(`/payment-approvals/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-approvals'] }),
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Finans</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldAlert className="size-6" />
          Ödeme Onayları
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          50.000 TL ve üzeri ödemeler iki onay gerektirir. Görevler ayrılığı: kendi başlattığın
          ödemeyi onaylayamazsın.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-brand-100 dark:border-slate-800 mb-4">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === s
                ? 'border-brand-900 dark:border-brand-300 text-brand-900 dark:text-slate-100 font-medium'
                : 'border-transparent text-brand-500 hover:text-brand-700 dark:hover:text-slate-300'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {q.data && q.data.length === 0 && (
        <div className="card text-center text-brand-500 dark:text-slate-400">
          Bu sekmede kayıt yok.
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="space-y-3">
          {q.data.map((a) => {
            const isMine = a.requested_by_user_id === me?.user.id;
            return (
              <div key={a.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/payables/${a.payable_id}`}
                      className="font-medium text-brand-900 dark:text-slate-100 hover:text-brand-700"
                    >
                      {a.payable_title ?? '(fatura silinmiş)'}
                    </Link>
                    {a.supplier_name && (
                      <p className="text-xs text-brand-500 dark:text-slate-400 mt-0.5">
                        {a.supplier_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-semibold">{fmtTRY(a.amount)}</p>
                    <span className={`badge text-xs ${STATUS_BADGE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 text-xs text-brand-600 dark:text-slate-400 mb-3">
                  <div>
                    <span className="text-brand-400">Yöntem:</span> {a.method}
                  </div>
                  <div>
                    <span className="text-brand-400">Ödeme Tarihi:</span> {a.paid_at}
                  </div>
                  {a.reference_no && (
                    <div>
                      <span className="text-brand-400">Referans:</span> {a.reference_no}
                    </div>
                  )}
                </div>

                {a.note && (
                  <p className="text-sm text-brand-700 dark:text-slate-300 bg-brand-50 dark:bg-slate-800 rounded p-2 mb-3">
                    💬 {a.note}
                  </p>
                )}

                {a.status === 'rejected' && a.decision_reason && (
                  <p className="text-sm text-red-700 bg-red-50 dark:bg-red-900/20 rounded p-2 mb-3">
                    <strong>Red sebebi:</strong> {a.decision_reason}
                  </p>
                )}

                {a.status === 'pending' && (
                  <div className="flex gap-2">
                    {isMine ? (
                      <>
                        <span className="text-xs text-brand-500 italic flex-1">
                          Kendi başlattığın için onaylayamazsın. Bir başka yöneticinin onayını bekle.
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('Bu öneriyi iptal et?')) cancel.mutate(a.id);
                          }}
                          className="text-xs text-brand-600 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded"
                        >
                          İptal Et
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => approve.mutate(a.id)}
                          disabled={approve.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1 disabled:opacity-60"
                        >
                          {approve.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Onayla
                        </button>
                        <button
                          onClick={() => setRejectModal(a.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1"
                        >
                          <X className="size-3" />
                          Reddet
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-brand-900 dark:text-slate-100 mb-2">
              Red sebebi
            </h3>
            <p className="text-sm text-brand-500 dark:text-slate-400 mb-3">
              Bu ödeme niye reddediliyor? Talep eden kişi bilgi alır.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
              placeholder="Örn: tutar hatalı, faturadan büyük"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setReason('');
                }}
                className="text-sm text-brand-600 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
              >
                Vazgeç
              </button>
              <button
                onClick={() => reject.mutate({ id: rejectModal, reason })}
                disabled={reason.length < 3 || reject.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm disabled:opacity-60"
              >
                {reject.isPending ? 'Reddediliyor…' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
