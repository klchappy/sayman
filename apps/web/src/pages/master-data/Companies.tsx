import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SECTOR_LABELS, SECTORS, type Sector } from '@sayman/shared';
import { PendingReviewBanner, PendingReviewEmptyHint } from '../../components/PendingReviewBanner';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Company {
  id: string;
  name: string;
  short_name: string | null;
  tax_number: string | null;
  registry_number: string | null;
  share_scope: '*' | string[];
  is_active: boolean;
}

export function CompaniesPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Company | 'new' | null>(null);

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canEdit = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  const q = useQuery({
    queryKey: ['companies', active.orgSlug, active.tenantSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Company[] }>('/companies');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/companies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
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
          <h1 className="text-2xl font-semibold text-brand-900">Şirketler</h1>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="size-4" />
            Yeni Şirket
          </button>
        )}
      </header>

      {editing && (
        <CompanyForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <PendingReviewBanner type="companies" />

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <>
            <p className="text-brand-500 text-sm py-6 text-center">Henüz şirket eklenmemiş.</p>
            <PendingReviewEmptyHint type="companies" />
          </>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Unvan</th>
                <th className="py-2 px-2">Kısa Ad</th>
                <th className="py-2 px-2">Vergi No</th>
                <th className="py-2 px-2">Sicil No</th>
                <th className="py-2 px-2">Görünür</th>
                <th className="py-2 px-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id} className={`border-b border-brand-50 hover:bg-brand-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                    <Building2 className="size-4 text-brand-400" />
                    {c.name}
                  </td>
                  <td className="py-2 px-2 text-brand-700">{c.short_name ?? '-'}</td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">{c.tax_number ?? '-'}</td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">{c.registry_number ?? '-'}</td>
                  <td className="py-2 px-2">
                    {c.share_scope === '*' ? (
                      <span className="badge-blue">Tüm</span>
                    ) : (
                      <span className="text-xs text-brand-600">{(c.share_scope as string[]).join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {canEdit && c.is_active && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(c)}
                          className="text-brand-600 hover:bg-brand-100 p-1.5 rounded"
                          title="Düzenle"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${c.name}" arşivlensin mi?`)) deleteMutation.mutate(c.id);
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

function CompanyForm({ initial, onClose }: { initial: Company | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [shortName, setShortName] = useState(initial?.short_name ?? '');
  const [tax, setTax] = useState(initial?.tax_number ?? '');
  const [reg, setReg] = useState(initial?.registry_number ?? '');
  const [shareAll, setShareAll] = useState(initial ? initial.share_scope === '*' : true);
  const [shareSelected, setShareSelected] = useState<string[]>(
    initial && Array.isArray(initial.share_scope) ? initial.share_scope : [],
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        short_name: shortName || null,
        tax_number: tax || null,
        registry_number: reg || null,
        share_scope: shareAll ? '*' : shareSelected,
      };
      if (isEdit) {
        await api.patch(`/companies/${initial!.id}`, body);
      } else {
        await api.post('/companies', body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">
          {isEdit ? `${initial!.name} — Düzenle` : 'Yeni Şirket'}
        </h3>
        <div className="space-y-3">
          <TextField label="Unvan *" value={name} onChange={setName} />
          <TextField label="Kısa Ad" value={shortName} onChange={setShortName} />
          <TextField label="Vergi No" value={tax} onChange={setTax} />
          <TextField label="Sicil No" value={reg} onChange={setReg} />

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
                if (!name) return setError('Unvan zorunlu');
                if (!shareAll && shareSelected.length === 0) return setError('En az 1 tenant seç');
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}
