import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Clock,
  Coins,
  Layers,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MODULES,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  PLANS,
  SECTORS,
  SECTOR_DEFAULT_MODULES,
  SECTOR_LABELS,
  type Module,
  type Plan,
  type Sector,
} from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type Tenant = {
  id: string;
  slug: string;
  name: string;
  sector: Sector;
  active_modules: string[];
  is_active: boolean;
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  contact_email: string | null;
  is_active: boolean;
  tenants: Tenant[];
};

interface ConsolidatedSummary {
  organization: { id: string; slug: string; name: string; plan: Plan };
  tenant_count: number;
  consolidated: {
    total_payables: number;
    total_paid: number;
    total_open: number;
    overdue_count: number;
    approaching_count: number;
    active_subscriptions: number;
    monthly_subscription: number;
    active_guarantees: number;
    guarantees_total: number;
  };
  per_tenant: Array<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    sector: Sector;
    total_payables: number;
    total_paid: number;
    total_open: number;
    overdue_count: number;
    active_subscriptions: number;
    monthly_subscription: number;
    active_guarantees: number;
    guarantees_total: number;
  }>;
}

import { fmtTRYShort as fmtTRY } from '../lib/formatting';

const PLAN_LABEL: Record<Plan, string> = {
  trial: 'Deneme',
  basic: 'Temel',
  pro: 'Pro',
  enterprise: 'Kurumsal',
};
const PLAN_BADGE: Record<Plan, string> = {
  trial: 'bg-brand-100 text-brand-700',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-emerald-100 text-emerald-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

export function OrganizationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const me = useAuth((s) => s.me);
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editOrg, setEditOrg] = useState(false);

  const role = me?.organizations.find((o) => o.slug === slug)?.role;
  const canEdit = role === 'super_admin' || role === 'organization_admin';

  const detailQuery = useQuery({
    queryKey: ['organizations', slug],
    queryFn: async () => {
      const res = await api.get<{ data: OrgDetail }>(`/organizations/${slug}`);
      return res.data.data;
    },
    enabled: !!slug,
  });

  const summaryQuery = useQuery({
    queryKey: ['organizations', slug, 'summary'],
    queryFn: async () => {
      const res = await api.get<{ data: ConsolidatedSummary }>(`/organizations/${slug}/summary`);
      return res.data.data;
    },
    enabled: !!slug,
  });

  return (
    <div className="min-h-full px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      <Link
        to="/orgs"
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
          <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-semibold text-brand-900">
                  {detailQuery.data.name}
                </h1>
                <span className={`badge ${PLAN_BADGE[detailQuery.data.plan]}`}>
                  {PLAN_LABEL[detailQuery.data.plan]}
                </span>
              </div>
              <p className="text-sm text-brand-500 font-mono">/{detailQuery.data.slug}</p>
              {detailQuery.data.contact_email && (
                <p className="text-sm text-brand-500 mt-1">
                  {detailQuery.data.contact_email}
                </p>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditOrg(true)}
                  className="flex items-center gap-2 bg-white border border-brand-200 hover:border-brand-300 text-brand-700 px-3 py-2 rounded-lg text-sm"
                >
                  <Pencil className="size-4" />
                  Organizasyonu Düzenle
                </button>
                <button
                  onClick={() => setShowNewTenant(true)}
                  className="flex items-center gap-2 bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  <Plus className="size-4" />
                  Yeni Tenant
                </button>
              </div>
            )}
          </header>

          {editOrg && (
            <OrgEditForm
              org={detailQuery.data}
              onClose={() => setEditOrg(false)}
            />
          )}

          {/* Konsolide özet — tüm tenant'lar toplam */}
          {summaryQuery.data && summaryQuery.data.tenant_count > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-brand-700 mb-3 flex items-center gap-2">
                <Layers className="size-4" />
                Konsolide Özet ({summaryQuery.data.tenant_count} tenant)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <ConsoldCard
                  icon={<Receipt className="size-4" />}
                  label="Toplam Fatura"
                  value={fmtTRY(summaryQuery.data.consolidated.total_payables)}
                />
                <ConsoldCard
                  icon={<Coins className="size-4" />}
                  label="Açık Bakiye"
                  value={fmtTRY(summaryQuery.data.consolidated.total_open)}
                  highlight={summaryQuery.data.consolidated.total_open > 0 ? 'amber' : undefined}
                />
                <ConsoldCard
                  icon={<AlertCircle className="size-4" />}
                  label="Geciken Fatura"
                  value={String(summaryQuery.data.consolidated.overdue_count)}
                  highlight={
                    summaryQuery.data.consolidated.overdue_count > 0 ? 'red' : undefined
                  }
                />
                <ConsoldCard
                  icon={<Clock className="size-4" />}
                  label="Yaklaşan (≤3 gün)"
                  value={String(summaryQuery.data.consolidated.approaching_count)}
                />
                <ConsoldCard
                  icon={<Repeat className="size-4" />}
                  label="Aktif Abonelik"
                  value={`${summaryQuery.data.consolidated.active_subscriptions} adet`}
                  subValue={fmtTRY(summaryQuery.data.consolidated.monthly_subscription) + ' / ay'}
                />
                <ConsoldCard
                  icon={<ShieldCheck className="size-4" />}
                  label="Teminat Mektubu"
                  value={`${summaryQuery.data.consolidated.active_guarantees} adet`}
                  subValue={fmtTRY(summaryQuery.data.consolidated.guarantees_total)}
                />
              </div>

              {/* Per-tenant tablo */}
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                      <th className="py-2 px-2">Tenant</th>
                      <th className="py-2 px-2 text-right">Toplam</th>
                      <th className="py-2 px-2 text-right">Açık</th>
                      <th className="py-2 px-2 text-center">Geciken</th>
                      <th className="py-2 px-2 text-center">Abone</th>
                      <th className="py-2 px-2 text-center">Teminat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryQuery.data.per_tenant.map((t) => (
                      <tr key={t.tenant_id} className="border-b border-brand-50 hover:bg-brand-50/50">
                        <td className="py-2 px-2">
                          <p className="font-medium text-brand-900">{t.tenant_name}</p>
                          <p className="text-xs text-brand-500 font-mono">{t.tenant_slug}</p>
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-brand-700">
                          {fmtTRY(t.total_payables)}
                        </td>
                        <td className="py-2 px-2 font-mono text-right text-amber-700">
                          {fmtTRY(t.total_open)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {t.overdue_count > 0 ? (
                            <span className="badge bg-red-100 text-red-700">{t.overdue_count}</span>
                          ) : (
                            <span className="text-brand-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-brand-700">
                          {t.active_subscriptions > 0 ? t.active_subscriptions : '-'}
                        </td>
                        <td className="py-2 px-2 text-center text-brand-700">
                          {t.active_guarantees > 0
                            ? `${t.active_guarantees} (${fmtTRY(t.guarantees_total)})`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showNewTenant && (
            <TenantForm
              orgSlug={detailQuery.data.slug}
              initial={null}
              onClose={() => setShowNewTenant(false)}
            />
          )}

          {editTenant && (
            <TenantForm
              orgSlug={detailQuery.data.slug}
              initial={editTenant}
              onClose={() => setEditTenant(null)}
            />
          )}

          <section>
            <div className="flex items-center gap-2 mb-4 text-brand-700">
              <Layers className="size-5" />
              <h2 className="font-semibold">Sektör Tenant'ları ({detailQuery.data.tenants.length})</h2>
            </div>

            {detailQuery.data.tenants.length === 0 && (
              <p className="text-sm text-brand-500 py-6 text-center card">
                Henüz tenant yok. Sağ üstten "Yeni Tenant" ile başlat.
              </p>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {detailQuery.data.tenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  orgSlug={detailQuery.data!.slug}
                  canEdit={canEdit}
                  onEdit={() => setEditTenant(tenant)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ConsoldCard({
  icon,
  label,
  value,
  subValue,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: 'amber' | 'red';
}) {
  const cls =
    highlight === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : highlight === 'red'
        ? 'border-red-200 bg-red-50'
        : 'border-brand-100 bg-white';
  const valCls =
    highlight === 'amber'
      ? 'text-amber-800'
      : highlight === 'red'
        ? 'text-red-700'
        : 'text-brand-900';
  return (
    <div className={`rounded-lg p-3 border ${cls}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-brand-500 mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-semibold font-mono ${valCls}`}>{value}</p>
      {subValue && <p className="text-xs text-brand-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

function TenantCard({
  tenant,
  orgSlug,
  canEdit,
  onEdit,
}: {
  tenant: Tenant;
  orgSlug: string;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => api.delete(`/tenants/${tenant.id}`, { headers: { 'X-Sayman-Org': orgSlug } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', orgSlug] }),
  });

  return (
    <div className={`card ${!tenant.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-brand-900">{tenant.name}</h3>
          <p className="text-xs text-brand-500 font-mono">
            {tenant.slug}.{orgSlug}.sayman
          </p>
        </div>
        {canEdit && tenant.is_active && (
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="text-brand-600 hover:bg-brand-100 p-1.5 rounded"
              title="Düzenle"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`"${tenant.name}" tenant'ı arşivlensin mi? (Veri silinmez, pasifleşir)`))
                  del.mutate();
              }}
              className="text-red-500 hover:bg-red-50 p-1.5 rounded"
              title="Arşivle"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      <span className="badge-blue mb-3">{SECTOR_LABELS[tenant.sector]}</span>
      <div className="mt-3">
        <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">
          Aktif modüller ({tenant.active_modules.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {tenant.active_modules.slice(0, 6).map((m) => (
            <span
              key={m}
              title={MODULE_DESCRIPTIONS[m as Module] ?? m}
              className="text-[10px] font-mono px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded cursor-help"
            >
              {m}
            </span>
          ))}
          {tenant.active_modules.length > 6 && (
            <span
              className="text-[10px] text-brand-400 cursor-help"
              title={tenant.active_modules
                .slice(6)
                .map((m) => `${m}: ${MODULE_DESCRIPTIONS[m as Module] ?? ''}`)
                .join('\n')}
            >
              +{tenant.active_modules.length - 6}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgEditForm({ org, onClose }: { org: OrgDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(org.name);
  const [contactEmail, setContactEmail] = useState(org.contact_email ?? '');
  const [plan, setPlan] = useState<Plan>(org.plan);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/organizations/${org.slug}`, {
        name,
        contact_email: contactEmail || null,
        plan,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', org.slug] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
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
        <h3 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
          <Building2 className="size-5" />
          Organizasyonu Düzenle
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Ad</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">İletişim E-postası</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Plan</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-brand-400">
            Slug ({org.slug}) değiştirilemez — subdomain ve URL referansları kırılmasın diye.
          </p>
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
              {save.isPending ? 'Kaydediliyor…' : 'Güncelle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantForm({
  orgSlug,
  initial,
  onClose,
}: {
  orgSlug: string;
  initial: Tenant | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [sector, setSector] = useState<Sector>(initial?.sector ?? 'insaat');
  const [modules, setModules] = useState<Set<Module>>(
    () =>
      new Set(
        (initial?.active_modules as Module[]) ?? SECTOR_DEFAULT_MODULES[initial?.sector ?? 'insaat'],
      ),
  );
  const [error, setError] = useState<string | null>(null);

  function onSectorChange(s: Sector) {
    setSector(s);
    if (!isEdit) setModules(new Set(SECTOR_DEFAULT_MODULES[s]));
  }

  function toggleModule(m: Module) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        sector,
        active_modules: [...modules],
        ...(isEdit ? {} : { slug: slug || undefined }),
      };
      const headers = { 'X-Sayman-Org': orgSlug };
      if (isEdit) {
        await api.patch(`/tenants/${initial!.id}`, body, { headers });
      } else {
        await api.post('/tenants', body, { headers });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizations', orgSlug] });
      qc.invalidateQueries({ queryKey: ['tenants-for-menu', orgSlug] });
      onClose();
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.message ?? err.response?.data?.error ?? (e as Error).message);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-brand-900 mb-4 text-lg">
          {isEdit ? `${initial!.name} — Düzenle` : 'Yeni Tenant'}
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-brand-500">Tenant Adı *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kılıç İnşaat"
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </label>
          {!isEdit && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-brand-500">
                Slug (boş bırakırsan ad'dan üretilir)
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="kilic-insaat"
                className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>
          )}
          {isEdit && (
            <p className="text-xs text-brand-400">
              Slug ({initial!.slug}) değiştirilemez.
            </p>
          )}

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
              Modülleri tek tek aç/kapa (Faz E filtre).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {MODULES.map((m) => (
                <label
                  key={m}
                  title={MODULE_DESCRIPTIONS[m]}
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
                  <span>
                    <span className="font-medium">{MODULE_LABELS[m]}</span>
                    <span className="block text-[10px] font-mono text-brand-400">{m}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-3">
            <button onClick={onClose} className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg text-sm">
              İptal
            </button>
            <button
              onClick={() => {
                setError(null);
                if (!name) return setError('Tenant adı zorunlu');
                if (modules.size === 0) return setError('En az 1 modül seç');
                save.mutate();
              }}
              disabled={save.isPending}
              className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {save.isPending ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Tenant Oluştur'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
