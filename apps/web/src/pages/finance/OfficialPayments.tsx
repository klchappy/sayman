import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Paperclip, Plus } from 'lucide-react';
import { useState } from 'react';
import { AttachmentModal } from '../../components/AttachmentModal';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSubsidiaries } from '../../lib/use-subsidiaries';

interface OfficialProfile {
  id: string;
  tenant_id?: string;
  tenant_name?: string | null;
  payment_type:
    | 'BAGKUR'
    | 'SSK'
    | 'BES'
    | 'ITO'
    | 'KGK'
    | 'GELIR'
    | 'KDV'
    | 'MTV'
    | 'OTHER';
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'semiannual' | 'occasional';
  owner_type: 'company' | 'person' | 'family' | 'other';
  typical_amount: string | null;
  currency: string;
  notes: string | null;
}

const TYPE_LABEL: Record<OfficialProfile['payment_type'], string> = {
  BAGKUR: 'BAĞKUR',
  SSK: 'SSK',
  BES: 'BES',
  ITO: 'İTO',
  KGK: 'KGK',
  GELIR: 'Gelir Vergisi',
  KDV: 'KDV',
  MTV: 'MTV',
  OTHER: 'Diğer',
};
const TYPE_BADGE: Record<OfficialProfile['payment_type'], string> = {
  BAGKUR: 'bg-emerald-100 text-emerald-700',
  SSK: 'bg-blue-100 text-blue-700',
  BES: 'bg-amber-100 text-amber-700',
  ITO: 'bg-purple-100 text-purple-700',
  KGK: 'bg-purple-100 text-purple-700',
  GELIR: 'bg-red-100 text-red-700',
  KDV: 'bg-red-100 text-red-700',
  MTV: 'bg-red-100 text-red-700',
  OTHER: 'bg-brand-100 text-brand-600',
};
const FREQ_LABEL: Record<OfficialProfile['frequency'], string> = {
  monthly: 'Aylık',
  quarterly: '3 Aylık',
  yearly: 'Yıllık',
  semiannual: '6 Aylık',
  occasional: 'Sıra Dışı',
};

import { fmtTRY as fmt } from '../../lib/formatting';

export function OfficialPaymentsPage() {
  const active = useAuth((s) => s.active);
  const [showForm, setShowForm] = useState(false);
  const [attachmentFor, setAttachmentFor] = useState<{ id: string; title: string } | null>(null);

  const q = useQuery({
    queryKey: ['official-payments', active.orgSlug, active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: OfficialProfile[] }>('/official-payments');
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
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug} / {active.tenantSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
            <Landmark className="size-6" />
            Resmi Ödemeler
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            BAĞKUR / SSK / BES / İTO / vergi profilleri.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Profil
        </button>
      </header>

      {showForm && <OPForm onClose={() => setShowForm(false)} />}
      {attachmentFor && (
        <AttachmentModal
          relatedTable="official_payment_profiles"
          relatedId={attachmentFor.id}
          title={`${attachmentFor.title} — Eklentiler`}
          onClose={() => setAttachmentFor(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">
            Henüz resmi ödeme profili yok.
          </p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Tip</th>
                <th className="py-2 px-2">Periyot</th>
                <th className="py-2 px-2">Sahip</th>
                <th className="py-2 px-2 text-right">Tipik Tutar</th>
                <th className="py-2 px-2">Not</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => (
                <tr key={p.id} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${TYPE_BADGE[p.payment_type]}`}>
                        {TYPE_LABEL[p.payment_type]}
                      </span>
                      {active.aggregate && p.tenant_name && (
                        <span className="text-[10px] uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                          {p.tenant_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-brand-700">{FREQ_LABEL[p.frequency]}</td>
                  <td className="py-2 px-2 text-brand-700">{p.owner_type}</td>
                  <td className="py-2 px-2 font-mono text-right">{fmt(p.typical_amount)}</td>
                  <td className="py-2 px-2 text-xs text-brand-600 max-w-xs truncate">
                    {p.notes ?? '-'}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() =>
                        setAttachmentFor({ id: p.id, title: TYPE_LABEL[p.payment_type] })
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

function OPForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const subsidiariesQ = useSubsidiaries();
  const [paymentType, setPaymentType] = useState<OfficialProfile['payment_type']>('BAGKUR');
  const [frequency, setFrequency] = useState<OfficialProfile['frequency']>('monthly');
  const [ownerType, setOwnerType] = useState<OfficialProfile['owner_type']>('company');
  const [typicalAmount, setTypicalAmount] = useState('');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/official-payments', {
        payment_type: paymentType,
        frequency,
        owner_type: ownerType,
        typical_amount: typicalAmount || null,
        subsidiary_id: subsidiaryId || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['official-payments'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Resmi Ödeme Profili</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tip"
              v={paymentType}
              on={(v) => setPaymentType(v as typeof paymentType)}
              opts={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="Periyot"
              v={frequency}
              on={(v) => setFrequency(v as typeof frequency)}
              opts={Object.entries(FREQ_LABEL).map(([value, label]) => ({ value, label }))}
            />
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
            <Text label="Tipik Tutar" v={typicalAmount} on={setTypicalAmount} ph="6500" />
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
              onClick={() => create.mutate()}
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
