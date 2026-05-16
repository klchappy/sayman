/**
 * /forecast — Nakit akış projeksiyon detay sayfası.
 *
 * Dashboard'daki widget'ın geniş versiyonu: 1-12 ay arası projeksiyon seçimi,
 * tablo + grafik, R² + slope açıklaması.
 */
import { useQuery } from '@tanstack/react-query';
import { Info, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface ForecastResponse {
  past: Array<{ ym: string; total_expense: number; total_paid: number }>;
  future: Array<{ ym: string; projected_expense: number }>;
  trend: { slope: number; intercept: number; r_squared: number; direction: string };
  meta: { lookback_months: number; projection_months: number };
}

function fmtTRY(v: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
}

export function ForecastPage() {
  const active = useAuth((s) => s.active);
  const [months, setMonths] = useState(6);

  const q = useQuery({
    queryKey: ['forecast-detail', active.tenantSlug, active.aggregate, months],
    enabled: !!active.tenantSlug || active.aggregate === true,
    queryFn: async () => {
      const res = await api.get<{ data: ForecastResponse }>(`/forecast/cashflow?months=${months}`);
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

  const combined =
    q.data && [
      ...q.data.past.map((p) => ({
        ym: p.ym,
        real: p.total_expense,
        projected: null as number | null,
      })),
      ...q.data.future.map((f) => ({
        ym: f.ym,
        real: null as number | null,
        projected: f.projected_expense,
      })),
    ];

  const Icon =
    q.data?.trend.direction === 'rising' ? TrendingUp : TrendingDown;
  const trendColor =
    q.data?.trend.direction === 'rising' ? 'text-red-500' : 'text-emerald-500';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">
          {active.orgSlug} / {active.tenantSlug}
        </p>
        <h1 className="text-2xl font-semibold text-brand-900">Nakit Akış Projeksiyonu</h1>
        <p className="text-sm text-brand-500 mt-1">
          Son 6 ay verisi üzerinden en küçük kareler (linear regression) ile gelecek ay tahmini.
        </p>
      </header>

      {/* Projeksiyon ayı seçimi */}
      <div className="card mb-6 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-brand-700">Projeksiyon süresi:</span>
        {[3, 6, 9, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              months === m
                ? 'bg-brand-900 text-white'
                : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            }`}
          >
            {m} ay
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="card flex items-center gap-2 text-brand-500">
          <Loader2 className="size-4 animate-spin" />
          Hesaplanıyor…
        </div>
      )}

      {q.data && combined && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-brand-500">Eğim (slope)</p>
              <p className={`text-2xl font-semibold mt-1 ${trendColor}`}>
                <Icon className="inline size-5 mr-1" />
                {q.data.trend.slope > 0 ? '+' : ''}
                {fmtTRY(q.data.trend.slope)}
              </p>
              <p className="text-xs text-brand-500 mt-1">aylık değişim</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-brand-500">R² (model uyumu)</p>
              <p className="text-2xl font-semibold text-brand-900 mt-1 font-mono">
                {(q.data.trend.r_squared * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-brand-500 mt-1">
                {q.data.trend.r_squared > 0.7
                  ? 'Güçlü bir trend var'
                  : q.data.trend.r_squared > 0.4
                    ? 'Orta düzey trend'
                    : 'Gürültülü veri — projeksiyon kabataslak'}
              </p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-brand-500">12 ay sonu beklenti</p>
              <p className="text-2xl font-semibold text-brand-900 mt-1">
                {fmtTRY(q.data.future[q.data.future.length - 1]?.projected_expense ?? 0)}
              </p>
              <p className="text-xs text-brand-500 mt-1">
                {q.data.future[q.data.future.length - 1]?.ym}
              </p>
            </div>
          </div>

          <section className="card mb-6">
            <h2 className="font-semibold text-brand-900 mb-4">Grafik (Bar = gerçek, Line = projeksiyon)</h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={combined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="ym" stroke="#6b7280" fontSize={12} />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => (v != null ? fmtTRY(Number(v)) : '-')}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="real" name="Gerçekleşen" fill="#0a2540" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projeksiyon"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#f97316', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className="card mb-6">
            <h2 className="font-semibold text-brand-900 mb-3">Detay Tablo</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                  <th className="py-2 px-2">Ay</th>
                  <th className="py-2 px-2 text-right">Gerçekleşen</th>
                  <th className="py-2 px-2 text-right">Projeksiyon</th>
                  <th className="py-2 px-2">Tip</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((row, i) => (
                  <tr key={i} className="border-b border-brand-50">
                    <td className="py-2 px-2 font-mono">{row.ym}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      {row.real != null ? fmtTRY(row.real) : '-'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-amber-700">
                      {row.projected != null ? fmtTRY(row.projected) : '-'}
                    </td>
                    <td className="py-2 px-2 text-xs">
                      {row.real != null ? (
                        <span className="text-brand-700">Geçmiş</span>
                      ) : (
                        <span className="text-amber-700">Tahmin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="card bg-blue-50 border-blue-100 text-sm text-blue-900 flex items-start gap-2">
            <Info className="size-4 mt-0.5 flex-shrink-0" />
            <p>
              Bu projeksiyon basit lineer regresyon — mevsimsellik (yaz/kış elektrik farkı,
              yılbaşı tatili, vergi dönemleri) hesaba katmaz. Daha doğru tahmin için ileride{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded">prophet</code> veya{' '}
              <code className="font-mono bg-white px-1 py-0.5 rounded">SARIMA</code> eklenebilir.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
