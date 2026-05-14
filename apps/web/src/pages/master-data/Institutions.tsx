import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Institution {
  id: string;
  name: string;
  institution_type: string | null;
  is_active: boolean;
}

const TYPE_OPTIONS = ['TT', 'CK', 'IGDAS', 'IBB', 'BAGKUR', 'SSK', 'BES', 'ITO', 'KGK', 'OTHER'];

export function InstitutionsPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const q = useQuery({
    queryKey: ['institutions', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => (await api.get<{ data: Institution[] }>('/institutions')).data.data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/institutions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }),
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
          <h1 className="text-2xl font-semibold text-brand-900">Kurumlar</h1>
          <p className="text-sm text-brand-500 mt-1">Telekom, elektrik, doğalgaz, BAĞKUR vb.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Kurum
        </button>
      </header>

      {showForm && <InstitutionForm onClose={() => setShowForm(false)} />}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Henüz kurum tanımı yok.</p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Ad</th>
                <th className="py-2 px-2">Tip</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((it) => (
                <tr key={it.id} className={`border-b border-brand-50 ${!it.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                    <Building className="size-4 text-brand-400" />
                    {it.name}
                  </td>
                  <td className="py-2 px-2">
                    {it.institution_type ? (
                      <span className="badge-blue">{it.institution_type}</span>
                    ) : (
                      <span className="text-brand-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {it.is_active && (
                      <button
                        onClick={() => {
                          if (confirm(`"${it.name}" arşivlensin mi?`)) del.mutate(it.id);
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
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

function InstitutionForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => api.post('/institutions', { name, institution_type: type || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institutions'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Kurum</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Kurum Adı *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Tip</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              <option value="">-</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Kurum adı zorunlu');
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
