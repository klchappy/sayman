import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Layers } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { SECTOR_LABELS, type Sector } from '@sayman/shared';
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
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-brand-900">{detailQuery.data.name}</h1>
            <p className="text-sm text-brand-500 font-mono">/{detailQuery.data.slug}</p>
          </header>

          <section>
            <div className="flex items-center gap-2 mb-4 text-brand-700">
              <Layers className="size-5" />
              <h2 className="font-semibold">Sektör Tenant'ları</h2>
            </div>

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
