/**
 * /cari — Cari (müşteri/tedarikçi) listesi + detay/ekstre.
 *
 * Veri ERP bağlantısından gelir (Paraşüt, Logo, Mikro, vb).
 * READ-ONLY — düzenleme ERP tarafında yapılır.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  Brain,
  Building2,
  Download,
  FileSpreadsheet,
  Globe,
  Loader2,
  Mail,
  Phone,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface CariRow {
  id: string;
  code: string | null;
  name: string;
  account_type: 'customer' | 'supplier' | 'both';
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  balance: string;
  currency: string;
  connection_id: string;
  last_synced_at: string;
}

interface CariDetail {
  cari: CariRow & {
    tax_office: string | null;
    address: string | null;
    raw_data: Record<string, unknown>;
  };
  connection: { id: string; name: string; provider: string } | null;
  stats: {
    total_debit: number;
    total_credit: number;
    movement_count: number;
    last_movement_date: string | null;
  };
  recent_movements: Movement[];
}

interface Movement {
  id: string;
  movement_date: string;
  description: string | null;
  document_no: string | null;
  document_type: string | null;
  debit: string;
  credit: string;
  balance_after: string | null;
  currency: string;
}

const TYPE_LABEL: Record<string, string> = {
  customer: 'Müşteri',
  supplier: 'Tedarikçi',
  both: 'Müşteri & Tedarikçi',
};

const TYPE_BADGE: Record<string, string> = {
  customer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  supplier: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  both: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-slate-300',
};

function fmtTRY(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

export function CariListPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'customer' | 'supplier'>('all');

  const q = useQuery({
    queryKey: ['cari-list', type, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type !== 'all') params.set('type', type);
      if (search) params.set('search', search);
      const res = await api.get<{ data: CariRow[] }>(`/cari?${params}`);
      return res.data.data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">ERP Verisi</p>
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="size-6" />
          Cari Hesaplar
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
          Muhasebe yazılımından gelen cari listesi. Bakiyeler, ekstre, vergi bilgisi.
        </p>
      </header>

      {/* Filtreler */}
      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="size-4 text-brand-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, kod, vergi no ile ara…"
            className="flex-1 rounded-lg border border-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'customer', 'supplier'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`text-xs px-3 py-1.5 rounded-lg ${
                type === t
                  ? 'bg-brand-900 text-white'
                  : 'bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-slate-700'
              }`}
            >
              {t === 'all' ? 'Tümü' : t === 'customer' ? 'Müşteri' : 'Tedarikçi'}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {q.data && q.data.length === 0 && (
        <div className="card text-center py-12">
          <Building2 className="size-12 mx-auto text-brand-300 mb-3" />
          <p className="text-brand-700 dark:text-slate-300 font-medium">Cari bulunamadı.</p>
          <p className="text-sm text-brand-500 dark:text-slate-400 mt-1">
            Önce <Link to="/erp" className="text-brand-700 underline">ERP bağlantısı</Link> kur ve sync et.
          </p>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-500 dark:text-slate-400 text-xs uppercase border-b border-brand-100 dark:border-slate-800">
                <th className="py-3 px-3">Cari Adı</th>
                <th className="py-3 px-3">Kod</th>
                <th className="py-3 px-3">Tip</th>
                <th className="py-3 px-3">Vergi No</th>
                <th className="py-3 px-3">İletişim</th>
                <th className="py-3 px-3 text-right">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-2.5 px-3 font-medium">
                    <Link
                      to={`/cari/${c.id}`}
                      className="text-brand-900 dark:text-slate-100 hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-brand-600 dark:text-slate-400">
                    {c.code ?? '-'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_BADGE[c.account_type]}`}>
                      {TYPE_LABEL[c.account_type]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{c.tax_id ?? '-'}</td>
                  <td className="py-2.5 px-3 text-xs text-brand-600 dark:text-slate-400">
                    {c.phone && <div className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1"><Mail className="size-3" />{c.email}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    <span
                      className={
                        Number(c.balance) > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : Number(c.balance) < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-brand-500'
                      }
                    >
                      {fmtTRY(c.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CariDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const q = useQuery({
    queryKey: ['cari-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: CariDetail }>(`/cari/${id}`);
      return res.data.data;
    },
  });

  const movements = useQuery({
    queryKey: ['cari-movements', id, page],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<{ data: Movement[] }>(
        `/cari/${id}/movements?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      return res.data.data;
    },
  });

  if (q.isLoading || !q.data) {
    return <div className="p-8 text-brand-500">Yükleniyor…</div>;
  }

  const c = q.data.cari;

  // Yürüyen bakiye hesabı (UI tarafında)
  let running = 0;
  const movementsWithRunning = (movements.data ?? []).map((m) => {
    running += Number(m.debit) - Number(m.credit);
    return { ...m, running };
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        to="/cari"
        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-900 dark:text-slate-400 dark:hover:text-slate-100 mb-4"
      >
        <ArrowLeft className="size-4" />
        Cari listesi
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
            {q.data.connection?.name} ({q.data.connection?.provider})
          </p>
          <h1 className="text-2xl font-semibold text-brand-900 dark:text-slate-100">{c.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-brand-500 dark:text-slate-400">
            {c.code && <span className="font-mono">{c.code}</span>}
            {c.tax_id && (
              <>
                <span>·</span>
                <span className="font-mono">VN: {c.tax_id}</span>
              </>
            )}
            {c.tax_office && (
              <>
                <span>·</span>
                <span>{c.tax_office} V.D.</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/cari/${c.id}/reconciliation`}
            className="border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <ArrowLeftRight className="size-4" />
            Mutabakat
          </Link>
          <Link
            to={`/cari/${c.id}/portal-tokens`}
            className="border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Globe className="size-4" />
            Portal Linki
          </Link>
        <a
          href={`/v1/cari/${c.id}/movements.xlsx`}
          className="border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          onClick={async (e) => {
            e.preventDefault();
            const r = await api.get<Blob>(`/cari/${c.id}/movements.xlsx`, {
              responseType: 'blob',
            });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cari-ekstre-${c.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <FileSpreadsheet className="size-4" />
          Excel İndir
        </a>
        </div>
      </header>

      <RiskScoreCard cariId={c.id} />

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Güncel Bakiye"
          value={fmtTRY(c.balance)}
          highlight={
            Number(c.balance) > 0 ? 'emerald' : Number(c.balance) < 0 ? 'red' : undefined
          }
          icon={<ArrowRightLeft className="size-4 text-brand-300" />}
        />
        <Kpi
          label="Toplam Borç"
          value={fmtTRY(q.data.stats.total_debit)}
          icon={<TrendingUp className="size-4 text-emerald-500" />}
        />
        <Kpi
          label="Toplam Alacak"
          value={fmtTRY(q.data.stats.total_credit)}
          icon={<TrendingDown className="size-4 text-red-500" />}
        />
        <Kpi
          label="Hareket Sayısı"
          value={String(q.data.stats.movement_count)}
          icon={<Download className="size-4 text-brand-300" />}
        />
      </div>

      {(c.address || c.phone || c.email) && (
        <div className="card mb-6 text-sm text-brand-700 dark:text-slate-300 space-y-1">
          {c.address && (
            <p>
              <span className="text-brand-400">Adres:</span> {c.address}
            </p>
          )}
          {c.phone && (
            <p>
              <span className="text-brand-400">Telefon:</span> {c.phone}
            </p>
          )}
          {c.email && (
            <p>
              <span className="text-brand-400">E-posta:</span> {c.email}
            </p>
          )}
        </div>
      )}

      {/* Ekstre tablosu */}
      <div className="card p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b border-brand-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900 dark:text-slate-100">
            Cari Ekstre ({q.data.stats.movement_count} hareket)
          </h2>
          <div className="text-xs text-brand-500 dark:text-slate-400 font-mono">
            Sayfa {page + 1} · {PAGE_SIZE}/sayfa
          </div>
        </div>

        {movements.isLoading && (
          <p className="text-sm text-brand-500 p-4">Hareketler yükleniyor…</p>
        )}

        {movementsWithRunning.length === 0 && !movements.isLoading && (
          <p className="text-sm text-brand-500 dark:text-slate-400 p-6 text-center">
            Bu cari için henüz hareket çekilmemiş. Bağlantı sync edilince gelir.
          </p>
        )}

        {movementsWithRunning.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 dark:text-slate-400 text-xs uppercase border-b border-brand-100 dark:border-slate-800 bg-brand-50/50 dark:bg-slate-800/30">
                  <th className="py-2 px-3">Tarih</th>
                  <th className="py-2 px-3">Belge</th>
                  <th className="py-2 px-3">Açıklama</th>
                  <th className="py-2 px-3 text-right">Borç</th>
                  <th className="py-2 px-3 text-right">Alacak</th>
                  <th className="py-2 px-3 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {movementsWithRunning.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-brand-50 dark:border-slate-800/50 hover:bg-brand-50/30 dark:hover:bg-slate-800/30"
                  >
                    <td className="py-2 px-3 font-mono text-xs">{m.movement_date}</td>
                    <td className="py-2 px-3 text-xs">
                      <span className="font-mono">{m.document_no ?? '-'}</span>
                      {m.document_type && (
                        <span className="ml-2 text-[10px] bg-brand-100 dark:bg-slate-800 text-brand-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          {m.document_type}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-brand-700 dark:text-slate-300 max-w-xs truncate">
                      {m.description ?? '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {Number(m.debit) > 0 ? fmtTRY(m.debit) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-red-700 dark:text-red-400">
                      {Number(m.credit) > 0 ? fmtTRY(m.credit) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-brand-900 dark:text-slate-100">
                      {fmtTRY(m.running)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-brand-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-brand-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 px-3 py-1 rounded disabled:opacity-40"
              >
                ← Önceki
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={movementsWithRunning.length < PAGE_SIZE}
                className="text-brand-600 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-slate-800 px-3 py-1 rounded disabled:opacity-40"
              >
                Sonraki →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface RiskScoreData {
  score: number;
  level: 'low' | 'medium' | 'high';
  summary: string;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
  method: 'claude' | 'rule_based';
}

function RiskScoreCard({ cariId }: { cariId: string }) {
  const [data, setData] = useState<RiskScoreData | null>(null);

  const ask = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: RiskScoreData }>(`/cari/${cariId}/risk-score`);
      return res.data.data;
    },
    onSuccess: (d) => setData(d),
  });

  const levelColor = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  const levelLabel = { low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk' };

  return (
    <div className="card mb-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border-purple-200 dark:border-purple-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="size-5 text-purple-600" />
          AI Risk Skoru
        </h3>
        {!data && (
          <button
            onClick={() => ask.mutate()}
            disabled={ask.isPending}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-60"
          >
            {ask.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Brain className="size-3" />
            )}
            Hesapla
          </button>
        )}
      </div>
      {!data && !ask.isPending && (
        <p className="text-xs text-brand-500 dark:text-slate-400">
          Hareket geçmişi + bakiye + paterni Claude tarafından analiz edilip 0-100 risk
          skoru üretir.
        </p>
      )}
      {data && (
        <>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <p className="text-4xl font-bold font-mono text-brand-900 dark:text-slate-100">
                {data.score}
              </p>
              <p className="text-[10px] text-brand-400">/ 100</p>
            </div>
            <div className="flex-1">
              <span
                className={`text-xs px-3 py-1 rounded-full border ${levelColor[data.level]}`}
              >
                {levelLabel[data.level]}
              </span>
              <p className="text-sm text-brand-700 dark:text-slate-300 mt-2">{data.summary}</p>
            </div>
          </div>
          {data.factors.length > 0 && (
            <div className="border-t border-purple-200 dark:border-purple-800 pt-2 mt-2">
              <p className="text-[10px] uppercase tracking-wide text-brand-500 mb-1">
                Faktörler
              </p>
              <ul className="space-y-1">
                {data.factors.map((f, i) => (
                  <li key={i} className="text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      {f.impact === 'positive' && '✓'}
                      {f.impact === 'negative' && '✗'}
                      {f.impact === 'neutral' && '○'}
                      <span className="text-brand-700 dark:text-slate-300">{f.factor}</span>
                    </span>
                    <span className="text-brand-400 font-mono">w:{f.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-brand-400 mt-2">
            Method: {data.method === 'claude' ? 'Claude AI' : 'Kural tabanlı'}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: 'emerald' | 'red';
}) {
  const cls =
    highlight === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : highlight === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-brand-900 dark:text-slate-100';
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-brand-500 dark:text-slate-400">
          {label}
        </span>
        {icon}
      </div>
      <p className={`text-xl font-semibold font-mono ${cls}`}>{value}</p>
    </div>
  );
}
