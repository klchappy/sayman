import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, Globe, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SECTOR_LABELS, type Sector } from '@sayman/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  sector: Sector;
  active_modules: string[];
  effective_modules: string[];
  sector_label: string;
}

export function TenantSwitcher() {
  const me = useAuth((s) => s.me);
  const active = useAuth((s) => s.active);
  const setActive = useAuth((s) => s.setActive);
  const isAdmin = useAuth((s) => s.isAdmin());
  const [open, setOpen] = useState(false);

  const tenantsQuery = useQuery({
    queryKey: ['tenants', active.orgSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: TenantListItem[] }>(`/tenants?org=${active.orgSlug}`);
      return res.data.data;
    },
  });

  useEffect(() => {
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-tenant-switcher]')) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const currentOrg = me?.organizations.find((o) => o.slug === active.orgSlug);
  const currentTenant = tenantsQuery.data?.find((t) => t.slug === active.tenantSlug);
  const inAggregate = active.aggregate && !active.tenantSlug;

  return (
    <div data-tenant-switcher className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${
          inAggregate
            ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-700'
            : 'border-brand-200 hover:bg-brand-50'
        }`}
      >
        {inAggregate ? (
          <Globe className="size-4 text-purple-600" />
        ) : (
          <Building2 className="size-4 text-brand-500" />
        )}
        <div className="text-left">
          <p className="text-sm font-medium text-brand-900 dark:text-slate-100">
            {currentOrg?.name ?? 'Organizasyon seç'}
          </p>
          {inAggregate ? (
            <p className="text-xs text-purple-700 dark:text-purple-300">
              <Globe className="size-3 inline mr-1" />
              Tüm şirketler (toplu)
            </p>
          ) : currentTenant ? (
            <p className="text-xs text-brand-500">
              <Layers className="size-3 inline mr-1" />
              {currentTenant.name} · {SECTOR_LABELS[currentTenant.sector]}
            </p>
          ) : null}
        </div>
        <ChevronDown className="size-4 text-brand-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg ring-1 ring-brand-100 z-50 p-2">
          {/* Organizations */}
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-brand-400">Organizasyonlar</p>
          </div>
          {me?.organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                setActive({ orgSlug: org.slug, tenantSlug: null, aggregate: false });
              }}
              className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                active.orgSlug === org.slug ? 'bg-brand-50' : 'hover:bg-brand-50'
              }`}
            >
              <div>
                <p className="font-medium text-brand-900">{org.name}</p>
                <p className="text-xs text-brand-500">
                  {org.role} · {org.plan}
                </p>
              </div>
              {active.orgSlug === org.slug && <span className="text-[10px] text-brand-600">aktif</span>}
            </button>
          ))}

          {/* Tenants of active org */}
          {active.orgSlug && (
            <>
              <div className="px-3 py-2 mt-2 border-t border-brand-100 pt-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wide text-brand-400">Sektör (Tenant)</p>
              </div>

              {/* Tüm Şirketler (aggregate) — sadece admin */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setActive({ tenantSlug: null, aggregate: true });
                    setOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm border-l-4 mb-1 ${
                    inAggregate
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500'
                      : 'hover:bg-purple-50 dark:hover:bg-purple-900/10 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-900 dark:text-purple-300">
                        Tüm Şirketler
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        Aggregate görünüm · sadece yönetici/admin
                      </p>
                    </div>
                  </div>
                  {inAggregate && (
                    <span className="text-[10px] text-purple-700 dark:text-purple-300">aktif</span>
                  )}
                </button>
              )}

              <div className="max-h-72 overflow-y-auto">
                {tenantsQuery.isLoading && (
                  <p className="px-3 py-2 text-xs text-brand-400">Yükleniyor…</p>
                )}
                {tenantsQuery.data?.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      setActive({ tenantSlug: tenant.slug, aggregate: false });
                      setOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      active.tenantSlug === tenant.slug && !inAggregate ? 'bg-brand-50' : 'hover:bg-brand-50'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-brand-900">{tenant.name}</p>
                      <p className="text-xs text-brand-500">
                        {SECTOR_LABELS[tenant.sector]} · {tenant.effective_modules.length} modül
                      </p>
                    </div>
                    {active.tenantSlug === tenant.slug && !inAggregate && (
                      <span className="text-[10px] text-brand-600">aktif</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
