import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Bank {
  id: string;
  name: string;
  short_code: string | null;
  is_active: boolean;
}

export function BanksPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Bank | 'new' | null>(null);

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canEdit = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  const q = useQuery({
    queryKey: ['banks', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => (await api.get<{ data: Bank[] }>('/banks')).data.data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/banks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banks'] }),
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Silme işlemi başarısız',
      );
    },
  });

  if (!active.orgSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Organizasyon seçilmedi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Master Data</p>
          <h1 className="text-2xl font-semibold text-brand-900">Bankalar</h1>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="size-4" />
            Yeni Banka
          </button>
        )}
      </header>

      {editing && (
        <BankForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Henüz banka tanımı yok.</p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Ad</th>
                <th className="py-2 px-2">Kısa Kod</th>
                <th className="py-2 px-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((b) => (
                <tr key={b.id} className={`border-b border-brand-50 hover:bg-brand-50 ${!b.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                    <Landmark className="size-4 text-brand-400" />
                    {b.name}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">{b.short_code ?? '-'}</td>
                  <td className="py-2 px-2 text-right">
                    {canEdit && b.is_active && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(b)}
                          className="text-brand-600 hover:bg-brand-100 p-1.5 rounded"
                          title="Düzenle"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${b.name}" arşivlensin mi?`)) del.mutate(b.id);
                          }}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                          title="Arşivle"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
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

function BankForm({ initial, onClose }: { initial: Bank | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [shortCode, setShortCode] = useState(initial?.short_code ?? '');
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, short_code: shortCode || null };
      if (isEdit) await api.patch(`/banks/${initial!.id}`, body);
      else await api.post('/banks', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">
          {isEdit ? `${initial!.name} — Düzenle` : 'Yeni Banka'}
        </h3>
        <div className="space-y-3">
          <Field label="Banka Adı *" value={name} onChange={setName} />
          <Field label="Kısa Kod" value={shortCode} onChange={setShortCode} placeholder="GAR, AKB, IS" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Banka adı zorunlu');
                save.mutate();
              }}
              disabled={save.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {save.isPending ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}
