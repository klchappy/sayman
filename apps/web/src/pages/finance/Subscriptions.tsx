import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { AttachmentModal } from '../../components/AttachmentModal';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSubsidiaries } from '../../lib/use-subsidiaries';

interface Subscription {
  id: string;
  subscription_no: string | null;
  package_name: string | null;
  owner_type: 'company' | 'person' | 'family' | 'other';
  auto_payment: boolean;
  monthly_amount: string | null;
  currency: string;
  start_date: string | null;
  commitment_end_date: string | null;
  status: 'active' | 'on_hold' | 'cancelled' | 'expired';
  notes: string | null;
}

const STATUS_LABEL: Record<Subscription['status'], string> = {
  active: 'Aktif',
  on_hold: 'Beklemede',
  cancelled: 'İptal',
  expired: 'Süresi Doldu',
};
const STATUS_BADGE: Record<Subscription['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-brand-100 text-brand-500',
};

function fmt(v: string | null) {
  if (!v) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(v));
}

export function SubscriptionsPage() {
  const active = useAuth((s) => s.active);
  const [showForm, setShowForm] = useState(false);
  const [attachmentFor, setAttachmentFor] = useState<{ id: string; title: string } | null>(null);

  const q = useQuery({
    queryKey: ['subscriptions', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Subscription[] }>('/subscriptions');
      return res.data.data;
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşedeki seçiciden bir sektör (tenant) seç.
          </p>
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
            <Repeat className="size-6" />
            Abonelikler
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            Telekom, internet, yazılım, üyelik & taahhüt sözleşmeleri.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Abonelik
        </button>
      </header>

      {showForm && <SubForm onClose={() => setShowForm(false)} />}
      {attachmentFor && (
        <AttachmentModal
          relatedTable="subscriptions"
          relatedId={attachmentFor.id}
          title={`${attachmentFor.title} — Eklentiler`}
          onClose={() => setAttachmentFor(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">
            Henüz abonelik yok. Sağ üstten "Yeni Abonelik" ekle.
          </p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Abone No / Paket</th>
                <th className="py-2 px-2">Sahip</th>
                <th className="py-2 px-2 text-right">Aylık</th>
                <th className="py-2 px-2">Başlangıç</th>
                <th className="py-2 px-2">Taahhüt Bitiş</th>
                <th className="py-2 px-2">Otomatik</th>
                <th className="py-2 px-2">Durum</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((s) => (
                <tr key={s.id} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="py-2 px-2">
                    <p className="font-medium text-brand-900">{s.package_name ?? '-'}</p>
                    {s.subscription_no && (
                      <p className="text-xs text-brand-500 font-mono">#{s.subscription_no}</p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-brand-700">{s.owner_type}</td>
                  <td className="py-2 px-2 font-mono text-right">{fmt(s.monthly_amount)}</td>
                  <td className="py-2 px-2 text-brand-700">{s.start_date ?? '-'}</td>
                  <td className="py-2 px-2 text-brand-700">{s.commitment_end_date ?? '-'}</td>
                  <td className="py-2 px-2 text-xs">
                    {s.auto_payment ? (
                      <span className="text-emerald-700">✓ Otomatik</span>
                    ) : (
                      <span className="text-brand-500">Manuel</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`badge ${STATUS_BADGE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() =>
                        setAttachmentFor({ id: s.id, title: s.package_name ?? 'Abonelik' })
                      }
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

function SubForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const subsidiariesQ = useSubsidiaries();
  const [packageName, setPackageName] = useState('');
  const [subscriptionNo, setSubscriptionNo] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [ownerType, setOwnerType] = useState<'company' | 'person' | 'family' | 'other'>('company');
  const [startDate, setStartDate] = useState('');
  const [commitmentEnd, setCommitmentEnd] = useState('');
  const [autoPayment, setAutoPayment] = useState(false);
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/subscriptions', {
        package_name: packageName || null,
        subscription_no: subscriptionNo || null,
        owner_type: ownerType,
        monthly_amount: monthlyAmount || null,
        start_date: startDate || null,
        commitment_end_date: commitmentEnd || null,
        auto_payment: autoPayment,
        subsidiary_id: subsidiaryId || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Abonelik</h3>
        <div className="space-y-3">
          <Text label="Paket Adı *" v={packageName} on={setPackageName} ph="Türk Telekom Fiber 100" />
          <div className="grid grid-cols-2 gap-3">
            <Text label="Abone No" v={subscriptionNo} on={setSubscriptionNo} />
            <Text label="Aylık Tutar" v={monthlyAmount} on={setMonthlyAmount} ph="299.90" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Sahip"
              v={ownerType}
              on={(v) => setOwnerType(v as typeof ownerType)}
              opts={[
                { value: 'company', label: 'Şirket' },
                { value: 'person', label: 'Şahıs' },
                { value: 'family', label: 'Aile' },
                { value: 'other', label: 'Diğer' },
              ]}
            />
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={autoPayment}
                onChange={(e) => setAutoPayment(e.target.checked)}
                className="size-4"
              />
              <span className="text-sm text-brand-700">Otomatik ödeme</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text label="Başlangıç" v={startDate} on={setStartDate} ph="2026-01-15" />
            <Text label="Taahhüt Bitiş" v={commitmentEnd} on={setCommitmentEnd} ph="2027-01-15" />
          </div>
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
                if (!packageName) return setError('Paket adı zorunlu');
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
