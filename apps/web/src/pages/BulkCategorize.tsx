/**
 * /tools/bulk-categorize — Kategorisi olmayan tüm faturaları topluca
 * sınıflandır. Rule-based önce, fail edenler için Claude AI fallback.
 *
 * Akış:
 *   1. Dry run: Önerileri göster, kullanıcı görüp onaylasın
 *   2. Apply: Tüm önerileri uygula
 */
import { useMutation } from '@tanstack/react-query';
import { Brain, CheckCircle2, Loader2, Play, Sparkles, Tag } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

interface Proposal {
  id: string;
  title: string;
  category: string;
  category_label: string;
  source: 'rule' | 'ai';
  confidence: number;
}

interface BulkResult {
  scanned: number;
  rule_matched: number;
  ai_matched: number;
  ai_used: boolean;
  unmatched: number;
  applied: number;
  dry_run: boolean;
  proposals: Proposal[];
}

export function BulkCategorizePage() {
  const active = useAuth((s) => s.active);
  const [useAi, setUseAi] = useState(false);
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<BulkResult | null>(null);

  const scan = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: BulkResult }>('/category-feedback/bulk-categorize', {
        use_ai: useAi,
        dry_run: true,
        limit,
      });
      return res.data.data;
    },
    onSuccess: (data) => setResult(data),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: BulkResult }>('/category-feedback/bulk-categorize', {
        use_ai: useAi,
        dry_run: false,
        limit,
      });
      return res.data.data;
    },
    onSuccess: (data) => setResult(data),
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">
            {active.aggregate ? 'Bu işlem için bir şirket seçmelisin' : 'Tenant seçilmedi'}
          </p>
          <p className="text-sm text-brand-500 mt-1">
            {active.aggregate
              ? 'Toplu kategorize tek şirket için çalışır — sağ üstten bir şirket seç.'
              : 'Sağ üstten bir şirket seç.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Araçlar</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Tag className="size-6" />
          Toplu AI Kategorize
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Kategorisi boş olan tüm faturaları tara, kural-tabanlı öner; eşleşmeyenleri Claude'a sor.
        </p>
      </header>

      <div className="card mb-6 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="font-medium text-brand-900 flex items-center gap-1">
              <Sparkles className="size-4 text-purple-600" />
              Claude AI fallback kullan
            </p>
            <p className="text-xs text-brand-500">
              Kural-tabanlı eşleşmeyen faturaları toplu olarak Claude'a yolla. ANTHROPIC_API_KEY
              gerekli; ~$0.001 / 100 fatura.
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <label className="text-sm text-brand-700">Tarama limiti:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {scan.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {result && result.dry_run ? 'Yeniden Tara' : 'Tara (Dry Run)'}
          </button>
          {result && result.dry_run && result.proposals.length > 0 && (
            <button
              onClick={() => apply.mutate()}
              disabled={apply.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {apply.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {result.proposals.length} Öneriyi Uygula
            </button>
          )}
        </div>
      </div>

      {result && (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-6">
            <Metric label="Taranan" value={result.scanned} />
            <Metric
              label="Kural Eşleşmesi"
              value={result.rule_matched}
              color="emerald"
              icon={<Tag className="size-3" />}
            />
            <Metric
              label="AI Eşleşmesi"
              value={result.ai_matched}
              color="purple"
              icon={<Sparkles className="size-3" />}
            />
            <Metric label="Eşleşmedi" value={result.unmatched} color="amber" />
          </div>

          {!result.dry_run && (
            <div className="card bg-emerald-50 border-emerald-200 mb-6">
              <p className="text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="size-5" />
                {result.applied} fatura güncellendi.
              </p>
            </div>
          )}

          {result.proposals.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="font-semibold text-brand-900 mb-3">
                Öneriler ({result.proposals.length})
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-500 text-xs uppercase border-b border-brand-100">
                    <th className="py-2 px-2">Fatura</th>
                    <th className="py-2 px-2">Önerilen Kategori</th>
                    <th className="py-2 px-2">Kaynak</th>
                    <th className="py-2 px-2 text-right">Güven</th>
                  </tr>
                </thead>
                <tbody>
                  {result.proposals.map((p) => (
                    <tr key={p.id} className="border-b border-brand-50">
                      <td className="py-1.5 px-2">{p.title}</td>
                      <td className="py-1.5 px-2">
                        <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-xs">
                          {p.category_label}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        {p.source === 'rule' ? (
                          <span className="text-xs text-emerald-700 flex items-center gap-1">
                            <Tag className="size-3" />
                            Kural
                          </span>
                        ) : (
                          <span className="text-xs text-purple-700 flex items-center gap-1">
                            <Brain className="size-3" />
                            Claude AI
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">
                        {(p.confidence * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color?: 'emerald' | 'purple' | 'amber';
  icon?: React.ReactNode;
}) {
  const cls =
    color === 'emerald'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : color === 'purple'
        ? 'text-purple-700 bg-purple-50 border-purple-200'
        : color === 'amber'
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-brand-900';
  return (
    <div className={`card ${color ? cls : ''}`}>
      <p className="text-[10px] uppercase tracking-wide flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}
