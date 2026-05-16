/**
 * /stock — ERP'den çekilen stok bakiyesi.
 *
 * Read-only: stok adetleri ERP'de yönetilir, Sayman'da sadece görüntüleme + kritik
 * eşik tanımlama (kritik altına düşünce uyarı).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  Edit3,
  Loader2,
  Package,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface StockItem {
  id: string;
  external_id: string;
  code: string | null;
  name: string;
  unit: string | null;
  quantity: string;
  purchase_price: string | null;
  sale_price: string | null;
  currency: string;
  critical_threshold: string | null;
  last_synced_at: string;
  tenant_name?: string | null;
}

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

export function StockPage() {
  const active = useAuth((s) => s.active);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const q = useQuery({
    queryKey: ['stock', active.tenantSlug, active.aggregate, search, lowOnly],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (lowOnly) params.set('low_only', 'true');
      const res = await api.get<{ data: StockItem[] }>(`/stock?${params}`);
      return res.data.data;
    },
  });

  if (!active.tenantSlug && !active.aggregate) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            Üst köşeden bir şirket seç veya "Tüm Şirketler" seç.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">ERP Verisi</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Package className="size-6" />
          Stok Bakiyesi
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Muhasebe yazılımından gelen ürün adetleri. Kritik stok eşiği tanımla; altına düştüğünde
          uyarı alırsın.
        </p>
      </header>

      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="size-4 text-brand-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün adı, kod ara…"
            className="flex-1 rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          Sadece kritik altı
        </label>
      </div>

      {q.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {q.data && q.data.length === 0 && (
        <div className="card text-center py-12">
          <Boxes className="size-12 mx-auto text-brand-300 mb-2" />
          {(search || lowOnly) ? (
            <>
              <p className="text-brand-700 dark:text-slate-300 font-medium">
                Eşleşen ürün bulunamadı
              </p>
              <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
                {search && <>"<strong>{search}</strong>" araması</>}
                {search && lowOnly && ' ve '}
                {lowOnly && <>"Sadece kritik" filtresi</>}
                {' '}aktif.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setLowOnly(false);
                }}
                className="text-sm text-brand-700 dark:text-slate-300 underline hover:no-underline mt-2"
              >
                Filtreyi temizle ↻
              </button>
            </>
          ) : (
            <>
              <p className="text-brand-700 dark:text-slate-300 font-medium">
                Stok kaydı bulunamadı.
              </p>
              <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
                Bir ERP bağlantısı kur ve sync et; ürünler buraya gelir.
              </p>
            </>
          )}
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Ürün</th>
                <th className="py-2.5 px-3">Kod</th>
                <th className="py-2.5 px-3 text-right">Stok</th>
                <th className="py-2.5 px-3 text-right">Kritik Eşik</th>
                <th className="py-2.5 px-3 text-right">Alış</th>
                <th className="py-2.5 px-3 text-right">Satış</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((s) => (
                <StockRow key={s.id} item={s} aggregate={!!active.aggregate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StockRow({ item, aggregate }: { item: StockItem; aggregate: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState(item.critical_threshold ?? '');

  const update = useMutation({
    mutationFn: async () => {
      await api.patch(`/stock/${item.id}`, {
        critical_threshold: threshold === '' ? null : threshold,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock'] });
      setEditing(false);
    },
    onError: (e) => {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      alert(
        err.response?.data?.message ??
          err.response?.data?.error ??
          (e as Error).message ??
          'Güncelleme başarısız',
      );
    },
  });

  const qty = Number(item.quantity);
  const critical = item.critical_threshold != null ? Number(item.critical_threshold) : null;
  const isCritical = critical != null && qty <= critical;

  return (
    <tr
      className={`border-b border-brand-50 dark:border-slate-800/50 ${
        isCritical ? 'bg-amber-50/40 dark:bg-amber-900/10' : 'hover:bg-brand-50/30 dark:hover:bg-slate-800/30'
      }`}
    >
      <td className="py-2 px-3 font-medium text-brand-900 dark:text-slate-100">
        {isCritical && (
          <AlertTriangle
            className="size-4 text-amber-600 inline mr-1"
            aria-label="Kritik stok"
          />
        )}
        {item.name}
        {aggregate && item.tenant_name && (
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
            {item.tenant_name}
          </span>
        )}
      </td>
      <td className="py-2 px-3 font-mono text-xs text-brand-600 dark:text-slate-400">
        {item.code ?? '-'}
      </td>
      <td
        className={`py-2 px-3 text-right font-mono font-semibold ${
          isCritical ? 'text-amber-700 dark:text-amber-400' : 'text-brand-900 dark:text-slate-100'
        }`}
      >
        {qty.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
        {item.unit && (
          <span className="text-[10px] text-brand-400 ml-1">{item.unit}</span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {editing ? (
          <span className="flex items-center gap-1 justify-end">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-20 rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-0.5 text-xs text-right"
              placeholder="0"
            />
            <button
              onClick={() => update.mutate()}
              disabled={update.isPending}
              className="text-xs text-emerald-700"
            >
              {update.isPending ? <Loader2 className="size-3 animate-spin" /> : '✓'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-brand-500">
              ✕
            </button>
          </span>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-mono text-brand-500 dark:text-slate-400 hover:text-brand-900 dark:hover:text-slate-100"
          >
            {critical != null ? critical.toLocaleString('tr-TR') : '-'}
            <Edit3 className="size-3 inline ml-1" />
          </button>
        )}
      </td>
      <td className="py-2 px-3 text-right font-mono text-xs text-brand-600 dark:text-slate-400">
        {item.purchase_price ? fmtTRY(item.purchase_price) : '-'}
      </td>
      <td className="py-2 px-3 text-right font-mono text-xs text-emerald-700 dark:text-emerald-400">
        {item.sale_price ? fmtTRY(item.sale_price) : '-'}
      </td>
      <td className="py-2 px-3 text-right text-[10px] text-brand-400">
        {item.last_synced_at && new Date(item.last_synced_at).toLocaleDateString('tr-TR')}
      </td>
    </tr>
  );
}
