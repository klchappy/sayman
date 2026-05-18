import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { PendingReviewBanner, PendingReviewEmptyHint } from '../../components/PendingReviewBanner';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { SECTOR_LABELS, SECTORS, type Sector } from '@sayman/shared';

interface Person {
  id: string;
  full_name: string;
  national_id: string | null;
  phone: string | null;
  family_group: string | null;
  share_scope: '*' | string[];
  is_active: boolean;
  created_at: string;
}

function maskTC(tc: string | null) {
  if (!tc) return '-';
  if (tc.length <= 4) return tc;
  return tc.slice(0, 3) + '*****' + tc.slice(-2);
}

export function PersonsPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canEdit = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  const personsQuery = useQuery({
    queryKey: ['persons', active.orgSlug, active.tenantSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: Person[] }>('/persons');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/persons/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
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
          <h1 className="text-2xl font-semibold text-brand-900">Şahıslar</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton resource="persons" label="Excel" />
          {canEdit && (
            <button
              onClick={() => setEditing('new')}
              className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="size-4" />
              Yeni Şahıs
            </button>
          )}
        </div>
      </header>

      {editing && (
        <PersonForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <PendingReviewBanner type="persons" />

      <div className="card overflow-x-auto">
        {personsQuery.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {personsQuery.data?.length === 0 && (
          <>
            <p className="text-brand-500 text-sm py-6 text-center">
              Henüz şahıs eklenmemiş. Yukarıdaki "Yeni Şahıs" butonunu kullan.
            </p>
            <PendingReviewEmptyHint type="persons" />
          </>
        )}
        {personsQuery.data && personsQuery.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Ad Soyad</th>
                <th className="py-2 px-2">TC</th>
                <th className="py-2 px-2">Telefon</th>
                <th className="py-2 px-2">Aile Grubu</th>
                <th className="py-2 px-2">Görünür</th>
                <th className="py-2 px-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {personsQuery.data.map((p) => (
                <tr key={p.id} className={`border-b border-brand-50 hover:bg-brand-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-2 font-medium text-brand-900 flex items-center gap-2">
                    <UserCircle className="size-4 text-brand-400" />
                    {p.full_name}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-brand-600">{maskTC(p.national_id)}</td>
                  <td className="py-2 px-2 text-brand-700">{p.phone ?? '-'}</td>
                  <td className="py-2 px-2 text-brand-700">{p.family_group ?? '-'}</td>
                  <td className="py-2 px-2">
                    {p.share_scope === '*' ? (
                      <span className="badge-blue">Tüm Tenant</span>
                    ) : (
                      <span className="text-xs text-brand-600">{(p.share_scope as string[]).join(', ')}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {canEdit && p.is_active && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(p)}
                          className="text-brand-600 hover:bg-brand-100 p-1.5 rounded"
                          title="Düzenle"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${p.full_name}" arşivlensin mi?`)) deleteMutation.mutate(p.id);
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

function PersonForm({ initial, onClose }: { initial: Person | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [tc, setTc] = useState(initial?.national_id ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [familyGroup, setFamilyGroup] = useState(initial?.family_group ?? '');
  const [shareAll, setShareAll] = useState(initial ? initial.share_scope === '*' : true);
  const [shareSelected, setShareSelected] = useState<string[]>(
    initial && Array.isArray(initial.share_scope) ? initial.share_scope : [],
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        full_name: fullName,
        national_id: tc || null,
        phone: phone || null,
        family_group: familyGroup || null,
        share_scope: shareAll ? '*' : shareSelected,
      };
      if (isEdit) {
        await api.patch(`/persons/${initial!.id}`, body);
      } else {
        await api.post('/persons', body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['persons'] });
      onClose();
    },
    onError: (err) => {
      const e = err as { response?: { data?: { error?: string; message?: string } } };
      setError(e.response?.data?.message ?? e.response?.data?.error ?? (err as Error).message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">
          {isEdit ? `${initial!.full_name} — Düzenle` : 'Yeni Şahıs'}
        </h3>
        <div className="space-y-3">
          <Field label="Ad Soyad *" value={fullName} onChange={setFullName} required />
          <Field label="TC No" value={tc} onChange={setTc} placeholder="11 hane" />
          <Field label="Telefon" value={phone} onChange={setPhone} />
          <Field label="Aile Grubu" value={familyGroup} onChange={setFamilyGroup} />

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
                if (!fullName) return setError('Ad Soyad zorunlu');
                if (!shareAll && shareSelected.length === 0)
                  return setError('En az 1 tenant seç veya "tüm" işaretle');
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
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-brand-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </label>
  );
}
