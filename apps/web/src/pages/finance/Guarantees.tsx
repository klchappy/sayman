import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Paperclip, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AttachmentModal } from '../../components/AttachmentModal';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSubsidiaries } from '../../lib/use-subsidiaries';

interface Guarantee {
  id: string;
  tenant_id?: string;
  tenant_name?: string | null;
  beneficiary_name: string;
  letter_no: string | null;
  amount: string;
  currency: string;
  issue_date: string | null;
  expiry_date: string | null;
  commission_rate: string | null;
  commission_frequency_months: number;
  status: 'active' | 'returned' | 'expired' | 'cancelled';
  notes: string | null;
}

const STATUS_LABEL: Record<Guarantee['status'], string> = {
  active: 'Aktif',
  returned: 'İade',
  expired: 'Süresi Doldu',
  cancelled: 'İptal',
};
const STATUS_BADGE: Record<Guarantee['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  returned: 'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-brand-100 text-brand-500',
};

import { fmtTRY as fmt } from '../../lib/formatting';

export function GuaranteesPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [attachmentFor, setAttachmentFor] = useState<{ id: string; title: string } | null>(null);

  const q = useQuery({
    queryKey: ['guarantees', active.orgSlug, active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: Guarantee[] }>('/guarantees');
      return res.data.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/guarantees/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guarantees'] }),
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
            <ShieldCheck className="size-6" />
            Teminat Mektupları
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            Banka teminat mektupları + periyodik komisyon planı.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Teminat
        </button>
      </header>

      {showForm && <GForm onClose={() => setShowForm(false)} />}
      {attachmentFor && (
        <AttachmentModal
          relatedTable="guarantees"
          relatedId={attachmentFor.id}
          title={`${attachmentFor.title} — Eklentiler`}
          onClose={() => setAttachmentFor(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Henüz teminat mektubu yok.</p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Lehdar</th>
                <th className="py-2 px-2">Mektup No</th>
                <th className="py-2 px-2 text-right">Tutar</th>
                <th className="py-2 px-2">Düzenleme</th>
                <th className="py-2 px-2">Vade</th>
                <th className="py-2 px-2">Komisyon</th>
                <th className="py-2 px-2">Durum</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((g) => (
                <tr key={g.id} className="border-b border-brand-50 hover:bg-brand-50">
                  <td className="py-2 px-2 font-medium text-brand-900">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{g.beneficiary_name}</span>
                      {active.aggregate && g.tenant_name && (
                        <span className="text-[10px] uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                          {g.tenant_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">
                    {g.letter_no ?? '-'}
                  </td>
                  <td className="py-2 px-2 font-mono text-right">{fmt(g.amount)}</td>
                  <td className="py-2 px-2 text-brand-700">{g.issue_date ?? '-'}</td>
                  <td className="py-2 px-2 text-brand-700">{g.expiry_date ?? '-'}</td>
                  <td className="py-2 px-2 text-xs text-brand-600">
                    {g.commission_rate ? (
                      <>
                        %{g.commission_rate} / {g.commission_frequency_months}ay
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`badge ${STATUS_BADGE[g.status]}`}>
                      {STATUS_LABEL[g.status]}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setAttachmentFor({ id: g.id, title: g.beneficiary_name })}
                        className="text-brand-600 hover:bg-brand-50 p-1.5 rounded"
                        title="Eklentiler"
                      >
                        <Paperclip className="size-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const r = await api.get<Blob>(`/pdf/guarantee/${g.id}`, { responseType: 'blob' });
                          const url = URL.createObjectURL(r.data);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `teminat-${g.letter_no ?? g.id.slice(0, 8)}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-brand-600 hover:bg-brand-50 p-1.5 rounded"
                        title="PDF İndir"
                      >
                        <FileDown className="size-4" />
                      </button>
                      {!active.aggregate && (
                        <button
                          onClick={() => {
                            if (confirm(`"${g.beneficiary_name}" teminatı silinsin mi?`)) {
                              remove.mutate(g.id);
                            }
                          }}
                          disabled={remove.isPending}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                          title="Sil"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
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

function GForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const subsidiariesQ = useSubsidiaries();
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [letterNo, setLetterNo] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [commissionFreq, setCommissionFreq] = useState('3');
  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/guarantees', {
        beneficiary_name: beneficiaryName,
        letter_no: letterNo || null,
        amount,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        commission_rate: commissionRate || null,
        commission_frequency_months: Number(commissionFreq) || 3,
        subsidiary_id: subsidiaryId || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guarantees'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Teminat Mektubu</h3>
        <div className="space-y-3">
          <Text label="Lehdar *" v={beneficiaryName} on={setBeneficiaryName} ph="ABC İnşaat A.Ş." />
          <div className="grid grid-cols-2 gap-3">
            <Text label="Mektup No" v={letterNo} on={setLetterNo} />
            <Text label="Tutar *" v={amount} on={setAmount} ph="100000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text label="Düzenleme Tarihi" v={issueDate} on={setIssueDate} ph="2026-01-15" />
            <Text label="Vade Tarihi" v={expiryDate} on={setExpiryDate} ph="2027-01-15" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Text label="Komisyon %" v={commissionRate} on={setCommissionRate} ph="2.50" />
            <Text label="Periyot (Ay)" v={commissionFreq} on={setCommissionFreq} ph="3" />
          </div>
          {(subsidiariesQ.data?.length ?? 0) > 0 && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">Yan Şirket / Şube (ops.)</span>
              <select
                value={subsidiaryId}
                onChange={(e) => setSubsidiaryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
              >
                <option value="">— (tenant kökü)</option>
                {(subsidiariesQ.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
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
                if (!beneficiaryName) return setError('Lehdar zorunlu');
                if (!amount || isNaN(Number(amount))) return setError('Geçerli tutar gir');
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
