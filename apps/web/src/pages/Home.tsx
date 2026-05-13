import { useQuery } from '@tanstack/react-query';
import { Building2, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PLAN_LABELS, type Plan } from '@sayman/shared';
import { api } from '../lib/api';

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  contact_email: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

export function HomePage() {
  const orgsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await api.get<{ data: Org[]; count: number }>('/organizations');
      return res.data;
    },
  });

  return (
    <div className="min-h-full px-6 py-10 max-w-6xl mx-auto">
      <header className="flex items-center gap-3 mb-8">
        <div className="size-12 rounded-xl bg-brand-900 text-white grid place-items-center text-xl font-semibold tracking-tight">
          Sy
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Sayman</h1>
          <p className="text-sm text-brand-600">Multi-Tenant Muhasebe Operasyon Platformu</p>
        </div>
      </header>

      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-3 text-brand-700">
          <Coins className="size-5" />
          <h2 className="font-semibold">Organizasyonlar</h2>
        </div>

        {orgsQuery.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {orgsQuery.error && (
          <p className="text-red-600 text-sm">
            API çağrısı başarısız: {(orgsQuery.error as Error).message}
          </p>
        )}

        {orgsQuery.data && orgsQuery.data.count === 0 && (
          <p className="text-brand-500 text-sm">Henüz organization yok. `pnpm db:seed` çalıştır.</p>
        )}

        {orgsQuery.data && orgsQuery.data.count > 0 && (
          <ul className="divide-y divide-brand-100">
            {orgsQuery.data.data.map((org) => (
              <li key={org.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-brand-400" />
                  <div>
                    <Link
                      to={`/orgs/${org.slug}`}
                      className="font-medium text-brand-900 hover:text-brand-700"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-brand-500 font-mono">{org.slug}</p>
                  </div>
                </div>
                <span className="badge-blue">{PLAN_LABELS[org.plan]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-xs text-brand-400 mt-10">
        <p>
          API: <code className="font-mono">{import.meta.env.VITE_API_URL ?? 'http://localhost:4300/v1'}</code>
        </p>
        <p>v0.1.0 — Faz A.0 (TS port)</p>
      </footer>
    </div>
  );
}
