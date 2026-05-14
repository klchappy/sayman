import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  PAYABLE_CATEGORIES,
  PAYMENT_METHODS,
  type PayableCategory,
  type PaymentMethod,
  type PayableStatus,
} from '@sayman/shared';
import { api } from '../../lib/api';
import { AttachmentBox } from '../../components/AttachmentBox';

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
  category: string | null;
  supplier_name: string | null;
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

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">{p.title}</h1>
          {p.invoice_number && <p className="text-sm text-brand-500 font-mono mt-1">#{p.invoice_number}</p>}
        </div>
        <button
          onClick={async () => {
            const r = await api.get<Blob>(`/pdf/payable/${p.id}`, { responseType: 'blob' });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fatura-${p.invoice_number ?? p.id.slice(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 px-3 py-2 border border-brand-200 rounded-lg text-sm text-brand-700 hover:bg-brand-50"
        >
          <FileDown className="size-4" />
          PDF İndir
        </button>
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

      <CategoryEditor
        payableId={p.id}
        currentCategory={p.category}
        title={p.title}
        supplier={p.supplier_name}
        notes={p.notes}
      />

      <AiExplainBox payableId={p.id} />

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <AttachmentBox relatedTable="payable_items" relatedId={p.id} />
        <SimilarPayables payableId={p.id} />
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

// --- Benzer Faturalar (metadata score) ---
interface SimilarItem {
  id: string;
  title: string;
  supplier_name: string | null;
  amount: string;
  due_date: string | null;
  status: string;
  invoice_number: string | null;
  category: string | null;
  score: number;
}

function SimilarPayables({ payableId }: { payableId: string }) {
  const q = useQuery({
    queryKey: ['similar-payable', payableId],
    queryFn: async () => {
      const res = await api.get<{ data: SimilarItem[] }>(`/similar/payable/${payableId}`);
      return res.data.data;
    },
  });

  return (
    <section className="card">
      <h3 className="font-semibold text-brand-900 mb-3 flex items-center gap-2">
        <Receipt className="size-5" />
        Benzer Faturalar
      </h3>
      {q.isLoading && <p className="text-sm text-brand-500">Aranıyor…</p>}
      {q.data && q.data.length === 0 && (
        <p className="text-sm text-brand-500 text-center py-4">Benzer kayıt yok.</p>
      )}
      {q.data && q.data.length > 0 && (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {q.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/payables/${s.id}`}
                className="flex items-center justify-between px-2 py-2 rounded hover:bg-brand-50 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900 truncate">{s.title}</p>
                  <p className="text-xs text-brand-500 truncate">
                    {s.supplier_name ?? '-'} · {s.due_date ?? '-'} · {s.category ?? '-'}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-mono text-sm text-brand-900">{fmtTRY(s.amount)}</p>
                  <p className="text-[10px] text-brand-400">score {s.score}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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

// --- AI açıklama (Claude) ---
function AiExplainBox({ payableId }: { payableId: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['ai-explain', payableId],
    enabled: open,
    queryFn: async () => {
      const res = await api.get<{
        data: {
          answer: string;
          stats: {
            history_count: number;
            mean_amount: number;
            current_vs_mean_ratio: number;
          };
        };
      }>(`/ai/explain/payable/${payableId}`);
      return res.data.data;
    },
  });

  return (
    <div className="card mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-brand-900 flex items-center gap-2">
          <Sparkles className="size-5 text-purple-600" />
          AI Açıklama
        </h3>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Sparkles className="size-3" />
            "Niye dikkat çekici?" sor
          </button>
        )}
      </div>
      {open && (
        <>
          {q.isLoading && (
            <p className="text-sm text-brand-500 flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Claude düşünüyor (tedarikçi geçmişi taranıyor)…
            </p>
          )}
          {q.data && (
            <>
              <p className="text-sm text-brand-900 whitespace-pre-line">{q.data.answer}</p>
              <p className="text-[10px] text-brand-400 mt-2 font-mono">
                {q.data.stats.history_count} geçmiş kayıt · ortalama{' '}
                {q.data.stats.mean_amount.toLocaleString('tr-TR')} TL · ratio{' '}
                {q.data.stats.current_vs_mean_ratio}x
              </p>
            </>
          )}
          {q.error && (
            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
              {(q.error as Error).message ?? 'AI yanıt veremedi.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// --- Kategori düzelt ---
interface CategorySuggestion {
  category: PayableCategory;
  confidence: number;
  matched_keyword?: string;
}

function CategoryEditor({
  payableId,
  currentCategory,
  title,
  supplier,
  notes,
}: {
  payableId: string;
  currentCategory: string | null;
  title: string;
  supplier: string | null;
  notes: string | null;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<PayableCategory | ''>(
    (currentCategory as PayableCategory | null) ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const sourceText = [title, supplier, notes].filter(Boolean).join(' | ');

  const submit = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error('Kategori seç');
      await api.post('/category-feedback', {
        payable_id: payableId,
        suggested_category: currentCategory,
        actual_category: chosen,
        source_text: sourceText,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payable', payableId] });
      setEditing(false);
    },
    onError: (e) => setError((e as Error).message),
  });

  const currentLabel = currentCategory
    ? (CATEGORY_LABELS[currentCategory as PayableCategory] ?? currentCategory)
    : 'Kategorisiz';

  return (
    <div className="card mb-6 bg-brand-50/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-brand-500" />
          <span className="text-sm text-brand-500">Kategori:</span>
          <span className="text-sm font-medium text-brand-900">{currentLabel}</span>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            className="text-xs text-brand-700 hover:text-brand-900 flex items-center gap-1"
          >
            <Pencil className="size-3" />
            Düzelt
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={chosen}
            onChange={(e) => setChosen(e.target.value as PayableCategory)}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">— seç —</option>
            {PAYABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !chosen}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-60 flex items-center gap-1"
          >
            <Check className="size-3" />
            {submit.isPending ? 'Kaydediliyor…' : 'Onayla'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-brand-600 hover:bg-brand-100 px-3 py-1.5 rounded"
          >
            İptal
          </button>
          {error && <p className="text-xs text-red-600 w-full">{error}</p>}
          <p className="text-[10px] text-brand-400 w-full">
            Bu düzeltme AI önerilerini iyileştirir — ileride aynı tedarikçi/başlık için doğru kategori önerilir.
          </p>
        </div>
      )}
    </div>
  );
}
