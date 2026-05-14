import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MODULES,
  SECTORS,
  SECTOR_DEFAULT_MODULES,
  SECTOR_LABELS,
  type Module,
  type Sector,
} from '@sayman/shared';
import { api } from '../lib/api';

type Tenant = {
  id: string;
  slug: string;
  name: string;
  sector: Sector;
  active_modules: string[];
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  tenants: Tenant[];
};

export function OrganizationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [showForm, setShowForm] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['organizations', slug],
    queryFn: async () => {
      const res = await api.get<{ data: OrgDetail }>(`/organizations/${slug}`);
      return res.data.data;
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-full px-6 py-10 max-w-6xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 mb-6"
      >
        <ArrowLeft className="size-4" />
        Tüm organizasyonlar
      </Link>

      {detailQuery.isLoading && <p className="text-brand-500">Yükleniyor…</p>}
      {detailQuery.error && (
        <p className="text-red-600">{(detailQuery.error as Error).message}</p>
      )}

      {detailQuery.data && (
        <>
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-brand-900">{detailQuery.data.name}</h1>
              <p className="text-sm text-brand-500 font-mono">/{detailQuery.data.slug}</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              <Plus className="size-4" />
              Yeni Tenant
            </button>
          </header>

          {showForm && (
            <NewTenantForm
              orgSlug={detailQuery.data.slug}
              onClose={() => setShowForm(false)}
            />
          )}

          <section>
            <div className="flex items-center gap-2 mb-4 text-brand-700">
              <Layers className="size-5" />
              <h2 className="font-semibold">Sektör Tenant'ları</h2>
            </div>

            {detailQuery.data.tenants.length === 0 && (
              <p className="text-sm text-brand-500 py-6 text-center card">
                Henüz tenant yok. Sağ üstten "Yeni Tenant" ile başlat.
              </p>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {detailQuery.data.tenants.map((tenant) => (
                <div key={tenant.id} className="card">
                  <h3 className="font-semibold text-brand-900 mb-1">{tenant.name}</h3>
                  <p className="text-xs text-brand-500 font-mono mb-3">
                    {tenant.slug}.{detailQuery.data.slug}.sayman
                  </p>
                  <span className="badge-blue mb-3">{SECTOR_LABELS[tenant.sector]}</span>
                  <div className="mt-3">
                    <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">
                      Aktif modüller ({tenant.active_modules.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {tenant.active_modules.slice(0, 6).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded"
                        >
                          {m}
                        </span>
                      ))}
                      {tenant.active_modules.length > 6 && (
                        <span className="text-[10px] text-brand-400">
                          +{tenant.active_modules.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function NewTenantForm({ orgSlug, onClose }: { orgSlug: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sector, setSector] = useState<Sector>('insaat');
  const [modules, setModules] = useState<Set<Module>>(
    () => new Set(SECTOR_DEFAULT_MODULES['insaat']),
  );
  const [error, setError] = useState<string | null>(null);

  function onSectorChange(s: Sector) {
    setSector(s);
    setModules(new Set(SECTOR_DEFAULT_MODULES[s]));
  }

  function toggleModule(m: Module) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  const create = useMutation({
    mutationFn: async () => {
      const headers = { 'X-Sayman-Org': orgSlug };
      await api.post(
        '/tenants',
        {
          name,
          slug: slug || undefined,
          sector,
          active_modules: [...modules],
        },
        { headers },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', orgSlug] });
      qc.invalidateQueries({ queryKey: ['tenants-for-menu', orgSlug] });
      onClose();
    },
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-brand-900 mb-4 text-lg">Yeni Tenant</h3>
        <div className="space-y-3">
          <Text label="Tenant Adı *" v={name} on={setName} ph="Kılıç İnşaat" />
          <Text
            label="Slug (boş bırakırsan ad'dan üretilir)"
            v={slug}
            on={setSlug}
            ph="kilic-insaat"
          />

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Sektör *</span>
            <select
              value={sector}
              onChange={(e) => onSectorChange(e.target.value as Sector)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs uppercase tracking-wide text-brand-500 mb-2">
              Aktif Modüller ({modules.size}/{MODULES.length})
            </p>
            <p className="text-xs text-brand-400 mb-2">
              Sektör seçince default açılır, sonra elle değiştirebilirsin (Faz E filtre).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {MODULES.map((m) => (
                <label
                  key={m}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer transition ${
                    modules.has(m)
                      ? 'bg-brand-50 border-brand-300 text-brand-900'
                      : 'border-brand-100 text-brand-500 hover:border-brand-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={modules.has(m)}
                    onChange={() => toggleModule(m)}
                    className="size-3.5"
                  />
                  <span className="font-mono">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm"
            >
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Tenant adı zorunlu');
                if (modules.size === 0) return setError('En az 1 modül seç');
                create.mutate();
              }}
              disabled={create.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {create.isPending ? 'Oluşturuluyor…' : 'Tenant Oluştur'}
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
