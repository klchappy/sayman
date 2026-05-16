import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Subsidiary {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_subsidiary_id: string | null;
  color: string | null;
  sort_order: string | null;
  is_active: boolean;
}

export function SubsidiariesPage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Subsidiary | 'new' | null>(null);

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canEdit = ['super_admin', 'organization_admin', 'yonetici', 'muhasebeci'].includes(role ?? '');

  const q = useQuery({
    queryKey: ['subsidiaries', active.orgSlug, active.tenantSlug],
    enabled: !!active.tenantSlug,
    queryFn: async () => (await api.get<{ data: Subsidiary[] }>('/subsidiaries')).data.data,
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/subsidiaries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subsidiaries'] }),
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

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Yan şirketler tenant içinde tanımlanır. Üst köşeden bir tenant seç.
          </p>
        </div>
      </div>
    );
  }

  // Hiyerarşi: parent → children map
  const byParent = (q.data ?? []).reduce<Record<string, Subsidiary[]>>((acc, s) => {
    const key = s.parent_subsidiary_id ?? '__root__';
    (acc[key] ??= []).push(s);
    return acc;
  }, {});
  const roots = byParent['__root__'] ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {active.orgSlug} / {active.tenantSlug}
          </p>
          <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
            <Network className="size-6" />
            Yan Şirketler & Şubeler
          </h1>
          <p className="text-sm text-brand-500 mt-1">
            Tenant içinde alt şirket/şube/bölüm. Faturalar, abonelikler ileride bunlara
            atanabilir (raporlama filtresi olarak şimdiden kullanılır).
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="size-4" />
            Yeni Yan Şirket
          </button>
        )}
      </header>

      {editing && (
        <SubsidiaryForm
          initial={editing === 'new' ? null : editing}
          allSubsidiaries={q.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="card">
        {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
        {q.data?.length === 0 && (
          <p className="text-sm text-brand-500 text-center py-6">
            Henüz yan şirket yok. Sağ üstten "Yeni Yan Şirket" ile başlat.
          </p>
        )}
        {roots.length > 0 && (
          <ul className="space-y-2">
            {roots.map((s) => (
              <SubsidiaryNode
                key={s.id}
                node={s}
                byParent={byParent}
                level={0}
                canEdit={canEdit}
                onEdit={(sub) => setEditing(sub)}
                onDelete={(id) => {
                  if (confirm('Bu yan şirket arşivlensin mi?')) del.mutate(id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SubsidiaryNode({
  node,
  byParent,
  level,
  canEdit,
  onEdit,
  onDelete,
}: {
  node: Subsidiary;
  byParent: Record<string, Subsidiary[]>;
  level: number;
  canEdit: boolean;
  onEdit: (s: Subsidiary) => void;
  onDelete: (id: string) => void;
}) {
  const children = byParent[node.id] ?? [];
  const indent = level * 20;

  return (
    <li>
      <div
        className={`flex items-center justify-between p-3 rounded-lg border ${
          node.is_active ? 'border-brand-100 hover:bg-brand-50' : 'border-brand-100 opacity-50'
        }`}
        style={{ marginLeft: indent }}
      >
        <div className="flex items-center gap-3">
          <Building2
            className="size-5"
            style={{ color: node.color ?? '#6b7280' }}
          />
          <div>
            <p className="font-medium text-brand-900">{node.name}</p>
            <p className="text-xs text-brand-500">
              {node.code && <span className="font-mono mr-2">#{node.code}</span>}
              {node.description ?? ''}
            </p>
          </div>
        </div>
        {canEdit && node.is_active && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(node)}
              className="text-brand-600 hover:bg-brand-100 p-1.5 rounded"
              title="Düzenle"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => onDelete(node.id)}
              className="text-red-500 hover:bg-red-50 p-1.5 rounded"
              title="Arşivle"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      {children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {children.map((c) => (
            <SubsidiaryNode
              key={c.id}
              node={c}
              byParent={byParent}
              level={level + 1}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SubsidiaryForm({
  initial,
  allSubsidiaries,
  onClose,
}: {
  initial: Subsidiary | null;
  allSubsidiaries: Subsidiary[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [parentId, setParentId] = useState(initial?.parent_subsidiary_id ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        code: code || null,
        description: description || null,
        parent_subsidiary_id: parentId || null,
        color: color || null,
      };
      if (isEdit) await api.patch(`/subsidiaries/${initial!.id}`, body);
      else await api.post('/subsidiaries', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subsidiaries'] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  // Parent dropdown: kendi-altındaki node'ları gizle (cycle önlemek için basit yaklaşım: sadece self'i gizle)
  const parentOptions = allSubsidiaries.filter((s) => !initial || s.id !== initial.id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="font-semibold text-brand-900 mb-4">
          {isEdit ? `${initial!.name} — Düzenle` : 'Yeni Yan Şirket'}
        </h3>
        <div className="space-y-3">
          <Field label="Ad *" value={name} onChange={setName} placeholder="Kılıç İnşaat İstanbul Şubesi" />
          <Field
            label="Kısa Kod"
            value={code}
            onChange={setCode}
            placeholder="ist-sube (URL'de kullanılır)"
          />
          <Field label="Açıklama" value={description} onChange={setDescription} />

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Bağlı Olduğu (parent)</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              <option value="">— (tenant kökünde)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <Field label="Renk (hex, ops.)" value={color} onChange={setColor} placeholder="#0a2540" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Ad zorunlu');
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
