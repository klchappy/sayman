import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface AuditRow {
  id: string;
  action: string;
  module: string;
  actor_id: string | null;
  target_table: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

const MODULE_FILTERS = [
  { value: '', label: 'Tümü' },
  { value: 'auth', label: 'Auth' },
  { value: 'security', label: 'Güvenlik' },
  { value: 'finance', label: 'Fatura' },
  { value: 'task', label: 'Görev' },
  { value: 'tenancy', label: 'Tenant' },
];

const ACTION_BADGE: Record<string, string> = {
  login: 'bg-emerald-100 text-emerald-700',
  logout: 'bg-brand-100 text-brand-600',
  create: 'bg-blue-100 text-blue-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  archive: 'bg-amber-100 text-amber-700',
  restore: 'bg-emerald-100 text-emerald-700',
  import: 'bg-blue-100 text-blue-700',
  export: 'bg-blue-100 text-blue-700',
  permission_change: 'bg-amber-100 text-amber-700',
};

export function AuditLogPage() {
  const active = useAuth((s) => s.active);
  const [filter, setFilter] = useState('');

  const q = useQuery({
    queryKey: ['audit', active.orgSlug, filter],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) params.set('action', filter);
      params.set('limit', '200');
      const res = await api.get<{ data: AuditRow[] }>(`/security/audit?${params}`);
      return res.data.data;
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
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Güvenlik</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Activity className="size-6" />
          Denetim Kayıtları
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Sayman'da yapılan tüm kritik aksiyonlar burada.
        </p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        {MODULE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filter === f.value
                ? 'bg-brand-900 text-white'
                : 'bg-white border border-brand-200 text-brand-700 hover:bg-brand-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {q.error && (
          <p className="text-sm text-red-600">
            Erişim yok — sadece super_admin/yönetici denetim kayıtlarını görebilir.
          </p>
        )}
        {q.data?.length === 0 && !q.isLoading && (
          <p className="text-brand-500 text-sm py-6 text-center">Kayıt yok.</p>
        )}
        {q.data && q.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                <th className="py-2 px-2">Tarih</th>
                <th className="py-2 px-2">Modül / Aksiyon</th>
                <th className="py-2 px-2">Hedef</th>
                <th className="py-2 px-2">IP</th>
                <th className="py-2 px-2">Detay</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.id} className="border-b border-brand-50 hover:bg-brand-50/50">
                  <td className="py-2 px-2 text-xs text-brand-700">
                    {new Date(r.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 px-2">
                    <p className="text-xs text-brand-500">{r.module}</p>
                    <span className={`badge ${ACTION_BADGE[r.action] ?? 'bg-brand-100 text-brand-600'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-xs text-brand-600 font-mono">
                    {r.target_table && (
                      <p>
                        {r.target_table}/{r.target_id?.slice(0, 8)}…
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-brand-500 font-mono">{r.ip_address ?? '-'}</td>
                  <td className="py-2 px-2 text-xs text-brand-600">
                    {r.after_data && Object.keys(r.after_data).length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-brand-500 hover:text-brand-700">
                          JSON
                        </summary>
                        <pre className="text-[10px] bg-brand-50 p-2 mt-1 rounded overflow-x-auto max-w-xs">
                          {JSON.stringify(r.after_data, null, 2)}
                        </pre>
                      </details>
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
