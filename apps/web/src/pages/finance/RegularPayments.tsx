import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HomeIcon, Paperclip, Plus } from 'lucide-react';
import { useState } from 'react';
import { AttachmentModal } from '../../components/AttachmentModal';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSubsidiaries } from '../../lib/use-subsidiaries';

interface RegularPayment {
  id: string;
  kind: 'rent' | 'maintenance' | 'subscription' | 'lease' | 'other';
  title: string;
  monthly_amount: string;
  currency: string;
  payment_day: number;
  start_date: string | null;
  end_date: string | null;
  annual_increase_rate: string | null;
  next_increase_date: string | null;
  notes: string | null;
}

const KIND_LABEL: Record<RegularPayment['kind'], string> = {
  rent: 'Kira',
  maintenance: 'Bakım',
  subscription: 'Sabit Abonelik',
  lease: 'Leasing',
  other: 'Diğer',
};
const KIND_BADGE: Record<RegularPayment['kind'], string> = {
  rent: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
  subscription: 'bg-emerald-100 text-emerald-700',
  lease: 'bg-purple-100 text-purple-700',
  other: 'bg-brand-100 text-brand-600',
};

function fmt(v: string | null) {
  if (!v) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(v));
}

export function RegularPaymentsPage() {
  const active = useAuth((s) => s.active);
  const [showForm, setShowForm] = useState(false);
  const [attachmentFor, setAttachmentFor] = useState<{ id: string; title: string } | null>(null);

  const q = useQuery({
    queryKey: ['regular-payments', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: RegularPayment[] }>('/regular-payments');
      return res.data.data;
    },
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug} / {active.tenantSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
            <HomeIcon className="size-6" />
            Kira & Düzenli Ödemeler
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            Kira sözleşmeleri, leasing, sabit yönetim/bakım giderleri.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Sözleşme
        </button>
      </header>

      {showForm && <RPForm onClose={() => setShowForm(false)} />}
      {attachmentFor && (
        <AttachmentModal
          relatedTable="regular_payment_profiles"
          relatedId={attachmentFor.id}
          title={`${attachmentFor.title} — Eklentiler`}
          onClose={() => setAttachmentFor(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">
            Henüz sözleşme yok. Sağ üstten "Yeni Sözleşme" ekle.
          </p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Tip</th>
                <th className="py-2 px-2">Başlık</th>
                <th className="py-2 px-2 text-right">Aylık</th>
                <th className="py-2 px-2">Ödeme Günü</th>
                <th className="py-2 px-2">Başl./Bitiş</th>
                <th className="py-2 px-2">Artış</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.id} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="py-2 px-2">
                    <span className={`badge ${KIND_BADGE[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                  </td>
                  <td className="py-2 px-2 font-medium text-brand-900">{r.title}</td>
                  <td className="py-2 px-2 font-mono text-right">{fmt(r.monthly_amount)}</td>
                  <td className="py-2 px-2 text-center text-brand-700">{r.payment_day}.</td>
                  <td className="py-2 px-2 text-xs text-brand-600">
                    {r.start_date ?? '-'} → {r.end_date ?? '-'}
                  </td>
                  <td className="py-2 px-2 text-xs text-brand-600">
                    {r.annual_increase_rate ? (
                      <>
                        %{r.annual_increase_rate}
                        {r.next_increase_date && (
                          <p className="text-[10px] text-brand-500">{r.next_increase_date}</p>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => setAttachmentFor({ id: r.id, title: r.title })}
                      className="text-brand-600 hover:bg-brand-50 p-1.5 rounded"
                      title="Eklentiler"
                    >
                      <Paperclip className="size-4" />
                    </button>
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

function RPForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const subsidiariesQ = useSubsidiaries();
  const [kind, setKind] = useState<RegularPayment['kind']>('rent');
  const [title, setTitle] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [paymentDay, setPaymentDay] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [annualIncrease, setAnnualIncrease] = useState('');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/regular-payments', {
        kind,
        title,
        monthly_amount: monthlyAmount,
        payment_day: Number(paymentDay) || 1,
        start_date: startDate || null,
        end_date: endDate || null,
        annual_increase_rate: annualIncrease || null,
        subsidiary_id: subsidiaryId || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regular-payments'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Düzenli Ödeme</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tip"
              v={kind}
              on={(v) => setKind(v as typeof kind)}
              opts={[
                { value: 'rent', label: 'Kira' },
                { value: 'maintenance', label: 'Bakım' },
                { value: 'subscription', label: 'Sabit Abonelik' },
                { value: 'lease', label: 'Leasing' },
                { value: 'other', label: 'Diğer' },
              ]}
            />
            <Text label="Aylık Tutar *" v={monthlyAmount} on={setMonthlyAmount} ph="15000" />
          </div>
          <Text label="Başlık *" v={title} on={setTitle} ph="Beşiktaş Daire 3+1" />
          <div className="grid grid-cols-3 gap-3">
            <Text label="Ödeme Günü" v={paymentDay} on={setPaymentDay} ph="1" />
            <Text label="Başlangıç" v={startDate} on={setStartDate} ph="2026-01-01" />
            <Text label="Bitiş" v={endDate} on={setEndDate} />
          </div>
          <Text label="Yıllık Artış %" v={annualIncrease} on={setAnnualIncrease} ph="25.00" />
          {(subsidiariesQ.data?.length ?? 0) > 0 && (
            <Select
              label="Yan Şirket / Şube (ops.)"
              v={subsidiaryId}
              on={setSubsidiaryId}
              opts={[
                { value: '', label: '— (tenant kökü)' },
                ...(subsidiariesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          )}
          <Text label="Notlar" v={notes} on={setNotes} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!title) return setError('Başlık zorunlu');
                if (!monthlyAmount || isNaN(Number(monthlyAmount)))
                  return setError('Geçerli aylık tutar gir');
                create.mutate();
              }}
              disabled={create.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {create.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Text({
  label,
  v,
  on,
  ph,
}: {
  label: string;
  v: string;
  on: (s: string) => void;
  ph?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type="text"
        value={v}
        onChange={(e) => on(e.target.value)}
        placeholder={ph}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}

function Select({
  label,
  v,
  on,
  opts,
}: {
  label: string;
  v: string;
  on: (s: string) => void;
  opts: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <select
        value={v}
        onChange={(e) => on(e.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
