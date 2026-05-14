import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SECTOR_LABELS, SECTORS, type Sector } from '@sayman/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Property {
  id: string;
  name: string;
  property_type: string | null;
  owner_person_id: string | null;
  owner_company_id: string | null;
  municipality: string | null;
  registry_number: string | null;
  site_unit_code: string | null;
  share_scope: '*' | string[];
  is_active: boolean;
}

const TYPE_OPTIONS = ['Ev', 'Daire', 'İşyeri', 'Arsa', 'Bina', 'Depo', 'Diğer'];

export function PropertiesPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const q = useQuery({
    queryKey: ['properties', active.orgSlug, active.tenantSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => (await api.get<{ data: Property[] }>('/properties')).data.data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
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
          <h1 className="text-2xl font-semibold text-brand-900">Mülkler</h1>
          <p className="text-sm text-brand-500 mt-1">
            Ev, daire, işyeri, arsa, bina vb. — emlak vergisi ve SiteX aidat kaynağı
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="size-4" />
          Yeni Mülk
        </button>
      </header>

      {showForm && <PropertyForm onClose={() => setShowForm(false)} />}

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-brand-500 text-sm py-6 text-center">Henüz mülk eklenmemiş.</p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Ad</th>
                <th className="py-2 px-2">Tip</th>
                <th className="py-2 px-2">Belediye</th>
                <th className="py-2 px-2">Sicil/Daire</th>
                <th className="py-2 px-2">Görünür</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => (
                <tr key={p.id} className={`border-b border-brand-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                    <Home className="size-4 text-brand-400" />
                    {p.name}
                  </td>
                  <td className="py-2 px-2 text-brand-700">{p.property_type ?? '-'}</td>
                  <td className="py-2 px-2 text-brand-700">{p.municipality ?? '-'}</td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">
                    {p.registry_number ?? p.site_unit_code ?? '-'}
                  </td>
                  <td className="py-2 px-2">
                    {p.share_scope === '*' ? (
                      <span className="badge-blue">Tüm</span>
                    ) : (
                      <span className="text-xs text-brand-600">{(p.share_scope as string[]).join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {p.is_active && (
                      <button
                        onClick={() => {
                          if (confirm(`"${p.name}" arşivlensin mi?`)) del.mutate(p.id);
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

function PropertyForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [registry, setRegistry] = useState('');
  const [siteUnit, setSiteUnit] = useState('');
  const [shareAll, setShareAll] = useState(true);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      api.post('/properties', {
        name,
        property_type: type || null,
        municipality: municipality || null,
        registry_number: registry || null,
        site_unit_code: siteUnit || null,
        share_scope: shareAll ? '*' : shareSelected,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-brand-900 mb-4">Yeni Mülk</h3>
        <div className="space-y-3">
          <TextField label="Mülk Adı *" value={name} onChange={setName} placeholder="Acıbadem Daire 5" />
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
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Belediye" value={municipality} onChange={setMunicipality} />
            <TextField label="Sicil No" value={registry} onChange={setRegistry} />
          </div>
          <TextField
            label="Site/Daire Kodu"
            value={siteUnit}
            onChange={setSiteUnit}
            placeholder="A12 (SiteX/Pruva34)"
          />

          <div>
            <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">Görünür Tenant'lar</p>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={shareAll}
                onChange={(e) => setShareAll(e.target.checked)}
              />
              <span className="text-sm">Tüm tenant'larda görünür (*)</span>
            </label>
            {!shareAll && (
              <div className="grid grid-cols-2 gap-2">
                {SECTORS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={shareSelected.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setShareSelected([...shareSelected, s]);
                        else setShareSelected(shareSelected.filter((x) => x !== s));
                      }}
                    />
                    {SECTOR_LABELS[s as Sector]}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Mülk adı zorunlu');
                if (!shareAll && shareSelected.length === 0) return setError('En az 1 tenant seç');
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

function TextField({
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
