/**
 * /fixed-assets — Demirbaş ve amortisman.
 *
 * Liste + KPI özet + yeni demirbaş + detay (amortisman çizelgesi).
 * Cron aylık 1'i 03:30'da otomatik amortisman entry'si üretir.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  Boxes,
  Building,
  Car,
  Loader2,
  Monitor,
  Plus,
  Sofa,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface FixedAsset {
  id: string;
  code: string | null;
  name: string;
  category: string;
  purchase_date: string;
  purchase_cost: string;
  currency: string;
  useful_life_months: string;
  depreciation_method: string;
  salvage_value: string;
  accumulated_depreciation: string;
  net_book_value: number;
  status: string;
  location: string | null;
  serial_no: string | null;
}

interface AssetSummary {
  total_cost: number;
  total_accumulated_depreciation: number;
  net_book_value: number;
  active_count: number;
  disposed_count: number;
  by_category: Array<{
    category: string;
    count: number;
    total_cost: number;
    net_book_value: number;
  }>;
}

const CATEGORY_LABEL: Record<string, string> = {
  vehicle: 'Taşıt',
  equipment: 'Ekipman',
  building: 'Bina',
  furniture: 'Mobilya',
  electronics: 'Elektronik',
  other: 'Diğer',
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  vehicle: Car,
  equipment: Wrench,
  building: Building,
  furniture: Sofa,
  electronics: Monitor,
  other: Boxes,
};

function fmtTRY(v: string | number) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

export function FixedAssetsPage() {
  const active = useAuth((s) => s.active);
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const summary = useQuery({
    queryKey: ['fixed-assets-summary', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: AssetSummary }>('/fixed-assets/summary');
      return res.data.data;
    },
  });

  const list = useQuery({
    queryKey: ['fixed-assets', active.tenantSlug, active.aggregate],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: FixedAsset[] }>('/fixed-assets');
      return res.data.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/fixed-assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
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
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Sabit Kıymet</p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="size-6" />
            Demirbaşlar
          </h1>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Taşıt, ekipman, bina, mobilya gibi varlıkların. Cron her ayın 1'inde otomatik
            amortisman entry'si üretir.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="size-4" />
          Yeni Demirbaş
        </button>
      </header>

      {summary.data && summary.data.active_count > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Toplam Maliyet" value={fmtTRY(summary.data.total_cost)} />
          <Kpi
            label="Birikmiş Amortisman"
            value={fmtTRY(summary.data.total_accumulated_depreciation)}
            highlight="amber"
            icon={<ArrowDown className="size-4 text-amber-500" />}
          />
          <Kpi
            label="Net Defter Değeri"
            value={fmtTRY(summary.data.net_book_value)}
            highlight="emerald"
          />
          <Kpi
            label="Aktif Demirbaş"
            value={`${summary.data.active_count} adet`}
            sub={`${summary.data.disposed_count} satılmış/imha`}
          />
        </div>
      )}

      {summary.data && summary.data.by_category.length > 0 && (
        <section className="card mb-6">
          <h2 className="font-semibold text-brand-900 dark:text-slate-100 mb-3 text-sm">
            Kategori Dağılımı
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {summary.data.by_category.map((c) => {
              const Icon = CATEGORY_ICON[c.category] ?? Boxes;
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="size-10 grid place-items-center rounded-lg bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-slate-300">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-brand-900 dark:text-slate-100">
                      {CATEGORY_LABEL[c.category] ?? c.category}
                    </p>
                    <p className="text-xs text-brand-500 dark:text-slate-400 font-mono">
                      {c.count} adet · {fmtTRY(c.net_book_value)} net
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showForm && <AssetForm onClose={() => setShowForm(false)} />}

      {list.isLoading && <p className="text-brand-500 text-sm">Yükleniyor…</p>}

      {list.data && list.data.length === 0 && !showForm && (
        <div className="card text-center py-12">
          <Boxes className="size-12 mx-auto text-brand-300 mb-2" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            Henüz demirbaş yok.
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-2.5 px-3">Kod</th>
                <th className="py-2.5 px-3">Demirbaş</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Alış Tarihi</th>
                <th className="py-2.5 px-3 text-right">Maliyet</th>
                <th className="py-2.5 px-3 text-right">Birikmiş</th>
                <th className="py-2.5 px-3 text-right">Net Değer</th>
                <th className="py-2.5 px-3">Durum</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((a) => {
                const Icon = CATEGORY_ICON[a.category] ?? Boxes;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2 px-3 font-mono text-xs">{a.code ?? '-'}</td>
                    <td className="py-2 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-brand-400" />
                        <span className="text-brand-900 dark:text-slate-100">{a.name}</span>
                      </div>
                      {a.serial_no && (
                        <p className="text-[10px] text-brand-400 font-mono">SN: {a.serial_no}</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-brand-500">
                      {CATEGORY_LABEL[a.category] ?? a.category}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{a.purchase_date}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmtTRY(a.purchase_cost)}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-700 dark:text-amber-400">
                      {fmtTRY(a.accumulated_depreciation)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      {fmtTRY(a.net_book_value)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          a.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-brand-100 text-brand-500 dark:bg-slate-800'
                        }`}
                      >
                        {a.status === 'active' ? 'Aktif' : a.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => {
                          if (confirm(`"${a.name}" silinsin mi?`)) remove.mutate(a.id);
                        }}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: 'amber' | 'emerald';
}) {
  const cls =
    highlight === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : highlight === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-brand-900 dark:text-slate-100';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-brand-500">{label}</span>
        {icon}
      </div>
      <p className={`text-xl font-semibold font-mono ${cls}`}>{value}</p>
      {sub && <p className="text-[10px] text-brand-400 mt-0.5 font-mono">{sub}</p>}
    </div>
  );
}

function AssetForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<keyof typeof CATEGORY_LABEL>('equipment');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('');
  const [lifeYears, setLifeYears] = useState(5);
  const [method, setMethod] = useState<'linear' | 'declining_balance'>('linear');
  const [salvage, setSalvage] = useState('0');
  const [serialNo, setSerialNo] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/fixed-assets', {
        name,
        code: code || null,
        category,
        purchase_date: purchaseDate,
        purchase_cost: cost,
        useful_life_months: lifeYears * 12,
        depreciation_method: method,
        declining_rate_pct: method === 'declining_balance' ? Math.min(100 / lifeYears, 50) : null,
        salvage_value: salvage,
        serial_no: serialNo || null,
        location: location || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="card mb-4 border-brand-300 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100">Yeni Demirbaş</h3>
        <button
          onClick={onClose}
          className="text-brand-500 hover:text-brand-900 dark:text-slate-400"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Demirbaş adı *"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Demirbaş kodu (örn DMR-001)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          type="date"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Alış maliyeti (TL) *"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <label className="text-xs text-brand-500 dark:text-slate-400">
          Faydalı ömür: <strong>{lifeYears} yıl ({lifeYears * 12} ay)</strong>
          <input
            type="range"
            min={1}
            max={50}
            value={lifeYears}
            onChange={(e) => setLifeYears(Number(e.target.value))}
            className="w-full"
          />
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        >
          <option value="linear">Lineer (eşit taksit)</option>
          <option value="declining_balance">Azalan bakiyeler</option>
        </select>
        <input
          value={salvage}
          onChange={(e) => setSalvage(e.target.value)}
          type="number"
          step="0.01"
          placeholder="Hurda değer (TL)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={serialNo}
          onChange={(e) => setSerialNo(e.target.value)}
          placeholder="Seri no (opsiyonel)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lokasyon (örn Ana Ofis)"
          className="rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onClose}
          className="text-sm text-brand-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 px-3 py-2 rounded"
        >
          İptal
        </button>
        <button
          onClick={() => {
            setError(null);
            if (name.length < 2) return setError('Ad zorunlu');
            if (!cost) return setError('Maliyet zorunlu');
            create.mutate();
          }}
          disabled={create.isPending}
          className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Kaydet
        </button>
      </div>
    </div>
  );
}
