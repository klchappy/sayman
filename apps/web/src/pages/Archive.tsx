/**
 * /arsiv — Soft-deleted kayıtların görüntülenmesi + Geri Yükle.
 *
 * Admin/yönetici yetkisi ile erişim. Entity seçici (Faturalar, Satış Faturaları,
 * Personel, vb.) — her entity için silinmiş kayıtlar listelenir, "Geri Yükle"
 * butonu ile is_active=true yapılır.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  CheckSquare,
  FileText,
  Package,
  Receipt,
  RefreshCw,
  Undo2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtTRY } from '../lib/formatting';
import { useConfirmBool } from '../components/ConfirmDialog';

type EntityKey = 'payable' | 'sales_invoice' | 'employee' | 'check' | 'fixed_asset' | 'company' | 'person';

interface ArchiveSummary {
  payable: number;
  sales_invoice: number;
  employee: number;
  check: number;
  fixed_asset: number;
  company: number;
  person: number;
  total: number;
}

const ENTITY_META: Record<EntityKey, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  apiPath: string;
}> = {
  payable: { label: 'Faturalar', icon: Receipt, apiPath: 'payables' },
  sales_invoice: { label: 'Satış Faturaları', icon: FileText, apiPath: 'sales-invoices' },
  employee: { label: 'Personel', icon: Users, apiPath: 'employees' },
  check: { label: 'Çek / Senet', icon: CheckSquare, apiPath: 'checks' },
  fixed_asset: { label: 'Demirbaşlar', icon: Package, apiPath: 'fixed-assets' },
  company: { label: 'Şirketler', icon: Building2, apiPath: 'companies' },
  person: { label: 'Şahıslar', icon: Users, apiPath: 'persons' },
};

interface ArchiveRow {
  id: string;
  tenant_id?: string;
  tenant_name?: string | null;
  organization_id?: string;
  // Display fields (entity'ye göre değişir)
  title?: string;
  full_name?: string;
  name?: string;
  supplier_name?: string;
  customer_name?: string;
  check_number?: string;
  direction?: string;
  category?: string;
  amount?: string;
  purchase_cost?: string;
  currency?: string;
  status?: string;
  tax_number?: string;
  tc_kimlik_no?: string;
  updated_at: string;
}

export function ArchivePage() {
  const active = useAuth((s) => s.active);
  const me = useAuth((s) => s.me);
  const qc = useQueryClient();
  const confirmBool = useConfirmBool();
  const [entity, setEntity] = useState<EntityKey>('payable');

  const role = me?.organizations.find((o) => o.slug === active.orgSlug)?.role;
  const canRestore = ['super_admin', 'organization_admin', 'yonetici'].includes(role ?? '');

  const summary = useQuery({
    queryKey: ['archive-summary', active.orgSlug],
    enabled: !!active.orgSlug && canRestore,
    queryFn: async () => {
      const res = await api.get<{ data: ArchiveSummary }>('/archive/summary');
      return res.data.data;
    },
  });

  const list = useQuery({
    queryKey: ['archive', active.orgSlug, active.tenantSlug, active.aggregate, entity],
    enabled: !!active.orgSlug && canRestore && (!!active.tenantSlug || active.aggregate === true),
    queryFn: async () => {
      const res = await api.get<{ data: ArchiveRow[] }>(`/archive?entity=${entity}`);
      return res.data.data;
    },
  });

  const restore = useMutation({
    mutationFn: async (row: ArchiveRow) => {
      const path = ENTITY_META[entity].apiPath;
      await api.post(`/${path}/${row.id}/restore`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archive'] });
      qc.invalidateQueries({ queryKey: ['archive-summary'] });
      // İlgili list cache'lerini de invalidate et
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['sales-invoices'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['checks'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(err.response?.data?.message ?? err.response?.data?.error ?? 'Geri yükleme başarısız');
    },
  });

  if (!canRestore) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <Archive className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 font-medium">Yetkisiz erişim</p>
          <p className="text-sm text-brand-500 mt-1">
            Arşiv ve geri yükleme sadece admin/yönetici rolü için.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Yönetim</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Archive className="size-6" />
          Arşiv (Silinmiş Kayıtlar)
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1 max-w-3xl">
          Silinmiş (soft-delete edilmiş) kayıtları görüntüle ve geri yükle. Geri yüklenen
          kayıtlar yeniden ana listede görünür. Sadece admin/yönetici erişebilir.
        </p>
      </header>

      {/* Entity seçici — sayı rozetleriyle */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(ENTITY_META) as EntityKey[]).map((k) => {
            const meta = ENTITY_META[k];
            const Icon = meta.icon;
            const count = summary.data?.[k] ?? 0;
            const isActive = entity === k;
            return (
              <button
                key={k}
                onClick={() => setEntity(k)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition ${
                  isActive
                    ? 'border-brand-500 bg-brand-50 dark:bg-slate-800 text-brand-900 dark:text-slate-100'
                    : 'border-brand-100 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800/50 text-brand-700 dark:text-slate-300'
                }`}
              >
                <Icon className="size-4" />
                <span className="font-medium">{meta.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    count > 0
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-brand-100 dark:bg-slate-800 text-brand-500 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}
        {list.data && list.data.length === 0 && (
          <p className="text-brand-500 text-sm text-center py-8">
            Bu kategoride silinmiş kayıt yok.
          </p>
        )}
        {list.data && list.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                  <th className="py-2 px-2">Kayıt</th>
                  {(['payable', 'sales_invoice', 'check', 'fixed_asset'] as EntityKey[]).includes(entity) && (
                    <th className="py-2 px-2 text-right">Tutar</th>
                  )}
                  <th className="py-2 px-2">Durum</th>
                  <th className="py-2 px-2">Silinme</th>
                  <th className="py-2 px-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id} className="border-b border-brand-50 hover:bg-brand-50/50">
                    <td className="py-2 px-2 font-medium text-brand-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{renderTitle(entity, row)}</span>
                        {active.aggregate && row.tenant_name && (
                          <span className="text-[10px] uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                            {row.tenant_name}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-400 font-mono">{row.id.slice(0, 8)}</p>
                    </td>
                    {(['payable', 'sales_invoice', 'check', 'fixed_asset'] as EntityKey[]).includes(entity) && (
                      <td className="py-2 px-2 font-mono text-right">
                        {fmtTRY(row.amount ?? row.purchase_cost ?? 0)}
                      </td>
                    )}
                    <td className="py-2 px-2 text-xs text-brand-600">
                      {row.status ?? '-'}
                    </td>
                    <td className="py-2 px-2 text-xs text-brand-500">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleDateString('tr-TR')
                        : '-'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={async () => {
                          if (
                            await confirmBool({
                              title: 'Geri Yükle',
                              message: `"${renderTitle(entity, row)}" geri yüklensin mi? Tekrar ana listede görünür olacak.`,
                              variant: 'info',
                              confirmLabel: 'Geri Yükle',
                            })
                          )
                            restore.mutate(row);
                        }}
                        disabled={restore.isPending}
                        className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-60"
                      >
                        {restore.isPending ? (
                          <RefreshCw className="size-3 animate-spin" />
                        ) : (
                          <Undo2 className="size-3" />
                        )}
                        Geri Yükle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function renderTitle(entity: EntityKey, row: ArchiveRow): string {
  switch (entity) {
    case 'payable':
    case 'sales_invoice':
      return row.title ?? row.supplier_name ?? row.customer_name ?? row.id.slice(0, 8);
    case 'employee':
    case 'person':
      return row.full_name ?? row.id.slice(0, 8);
    case 'check':
      return `${row.direction === 'incoming' ? '⬇' : '⬆'} ${row.check_number ?? row.id.slice(0, 8)}`;
    case 'fixed_asset':
      return row.name ?? row.id.slice(0, 8);
    case 'company':
      return row.name ?? row.tax_number ?? row.id.slice(0, 8);
    default:
      return row.id.slice(0, 8);
  }
}
