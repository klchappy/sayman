import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PAYMENT_METHODS, type PaymentMethod, type PayableStatus } from '@sayman/shared';
import { api } from '../../lib/api';

interface Payment {
  id: string;
  paid_at: string;
  amount: string;
  method: PaymentMethod;
  reference_no: string | null;
  status: string;
  is_active: boolean;
}

interface PayableDetail {
  id: string;
  title: string;
  invoice_number: string | null;
  period_label: string | null;
  amount: string;
  paid_amount: string;
  status: PayableStatus;
  due_date: string | null;
  notes: string | null;
  transactions: Payment[];
}

function fmtTRY(v: string) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(v));
}

export function PayableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const q = useQuery({
    queryKey: ['payable', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: PayableDetail }>(`/payables/${id}`);
      return res.data.data;
    },
  });

  const addPayment = useMutation({
    mutationFn: async (input: { paid_at: string; amount: string; method: PaymentMethod }) => {
      await api.post('/payments', { payable_id: id, ...input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payable', id] });
      qc.invalidateQueries({ queryKey: ['payables'] });
      setShowForm(false);
    },
  });

  if (q.isLoading) return <div className="p-8 text-brand-500">Yükleniyor…</div>;
  if (!q.data) return <div className="p-8 text-red-600">Fatura bulunamadı</div>;

  const p = q.data;
  const remaining = Number(p.amount) - Number(p.paid_amount);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/payables" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 mb-6">
        <ArrowLeft className="size-4" />
        Faturalar
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-900">{p.title}</h1>
        {p.invoice_number && <p className="text-sm text-brand-500 font-mono mt-1">#{p.invoice_number}</p>}
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase text-brand-500">Tutar</p>
          <p className="text-xl font-semibold text-brand-900 font-mono mt-1">{fmtTRY(p.amount)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-brand-500">Ödenen</p>
          <p className="text-xl font-semibold text-emerald-700 font-mono mt-1">{fmtTRY(p.paid_amount)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-brand-500">Kalan</p>
          <p className="text-xl font-semibold text-amber-700 font-mono mt-1">{fmtTRY(remaining.toFixed(2))}</p>
        </div>
      </div>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brand-900">Ödemeler ({p.transactions.length})</h2>
          {p.status !== 'paid' && remaining > 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              <Plus className="size-3" />
              Ödeme Ekle
            </button>
          )}
        </div>

        {showForm && (
          <PaymentForm
            remaining={remaining}
            onClose={() => setShowForm(false)}
            onSubmit={(data) => addPayment.mutate(data)}
            isPending={addPayment.isPending}
          />
        )}

        {p.transactions.length === 0 ? (
          <p className="text-sm text-brand-500 py-4 text-center">Henüz ödeme yapılmamış.</p>
        ) : (
          <ul className="divide-y divide-brand-100">
            {p.transactions.map((tx) => (
              <li key={tx.id} className={`py-3 flex items-center justify-between ${!tx.is_active ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm text-brand-900">{tx.paid_at}</p>
                  <p className="text-xs text-brand-500">
                    {tx.method.toUpperCase()}
                    {tx.reference_no && ` · ${tx.reference_no}`}
                  </p>
                </div>
                <p className="font-mono text-emerald-700">{fmtTRY(tx.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentForm({
  remaining,
  onClose,
  onSubmit,
  isPending,
}: {
  remaining: number;
  onClose: () => void;
  onSubmit: (data: { paid_at: string; amount: string; method: PaymentMethod }) => void;
  isPending: boolean;
}) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '');
  const [method, setMethod] = useState<PaymentMethod>('eft');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-4 p-4 bg-brand-50 rounded-lg border border-brand-100">
      <h4 className="font-medium text-brand-900 mb-3">Yeni Ödeme</h4>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="text-xs uppercase text-brand-500">Tarih</span>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="mt-1 w-full rounded border border-brand-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-brand-500">Tutar</span>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded border border-brand-200 px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-brand-500">Yöntem</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="mt-1 w-full rounded border border-brand-200 px-2 py-1.5 text-sm bg-white"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-brand-600 hover:bg-brand-100 rounded text-sm">
          İptal
        </button>
        <button
          onClick={() => {
            setError(null);
            if (!paidAt) return setError('Tarih zorunlu');
            if (!amount || isNaN(Number(amount))) return setError('Geçerli tutar gir');
            onSubmit({ paid_at: paidAt, amount, method });
          }}
          disabled={isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-60"
        >
          {isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
