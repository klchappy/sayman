/**
 * /ai — Doğal dil sorgu Sayman AI asistanı.
 *
 * Kullanıcı: "Bu ay vadesi geçen 1000 TL üstü faturalar"
 *           "Önümüzdeki 30 günde dolan teminat mektupları"
 *           "Toplam açık bakiyem ne kadar"
 *
 * Backend Claude API'sine yönlendirir + tool_use ile DB sorgular + Türkçe yanıt.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface AskResponse {
  query: string;
  answer: string;
  tool_calls: Array<{ name: string; input: any; result: any }>;
  iterations: number;
}

const EXAMPLES = [
  'Bu ay vadesi geçen 1000 TL üstü faturalar nedir?',
  'Önümüzdeki 30 günde vadesi dolan teminat mektupları?',
  'Toplam açık bakiye ne kadar, geciken kaç fatura var?',
  'Türk Telekom\'a yaptığım son ödemeler',
  'Bu ay BAĞKUR ödemesi yaptım mı?',
];

export function AIAssistantPage() {
  const active = useAuth((s) => s.active);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<AskResponse[]>([]);

  const status = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => (await api.get<{ data: { configured: boolean } }>('/ai/status')).data.data,
  });

  const ask = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: AskResponse }>('/ai/ask', { query });
      return res.data.data;
    },
    onSuccess: (data) => {
      setHistory((h) => [data, ...h]);
      setQuery('');
    },
  });

  if (!active.tenantSlug) {
    return (
      <div className="p-10 max-w-3xl mx-auto text-center">
        <div className="card">
          <p className="text-brand-700 font-medium">Tenant seçilmedi</p>
          <p className="text-sm text-brand-500 mt-1">
            AI asistan tenant verisine erişir. Üst köşeden bir tenant seç.
          </p>
        </div>
      </div>
    );
  }

  if (status.data && !status.data.configured) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="card bg-amber-50 border-amber-200">
          <h2 className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
            <AlertCircle className="size-5" />
            AI Asistan henüz aktif değil
          </h2>
          <p className="text-sm text-amber-800">
            <code className="font-mono bg-white px-1.5 py-0.5 rounded">ANTHROPIC_API_KEY</code> env
            yapılandırılmadı. Coolify'da set et + API'yi yeniden başlat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">AI</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Sparkles className="size-6" />
          Sayman Asistan
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Doğal dilde sor — fatura, teminat, abonelik verilerin üzerinde Claude AI çalışır.
        </p>
      </header>

      {/* Input */}
      <div className="card mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !ask.isPending && query.length >= 2) ask.mutate();
            }}
            placeholder="Bana bir şey sor..."
            className="flex-1 rounded-lg border border-brand-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-400"
            disabled={ask.isPending}
          />
          <button
            onClick={() => ask.mutate()}
            disabled={ask.isPending || query.length < 2}
            className="bg-brand-900 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-60"
          >
            {ask.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span>Sor</span>
          </button>
        </div>
        {ask.error && (
          <p className="text-sm text-red-600 mt-2">
            {(ask.error as Error).message ?? 'Hata'}
          </p>
        )}

        {/* Örnekler */}
        {history.length === 0 && (
          <div className="mt-4 pt-4 border-t border-brand-100">
            <p className="text-xs text-brand-500 mb-2">Örnek sorular:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-full border border-brand-100"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="space-y-4">
        {history.map((h, i) => (
          <div key={i} className="card">
            <p className="text-xs text-brand-500 mb-2 flex items-center gap-1">
              <span>Soru:</span>
              <strong className="text-brand-700">{h.query}</strong>
            </p>
            <div className="bg-brand-50 rounded-lg p-3 mb-3">
              <p className="text-sm text-brand-900 whitespace-pre-line">{h.answer}</p>
            </div>
            {h.tool_calls.length > 0 && (
              <details>
                <summary className="text-xs text-brand-400 cursor-pointer hover:text-brand-600">
                  Teknik detay ({h.tool_calls.length} tool çağrısı, {h.iterations} iter)
                </summary>
                <ul className="mt-2 space-y-2">
                  {h.tool_calls.map((tc, j) => (
                    <li key={j} className="bg-brand-50/50 rounded p-2 text-xs">
                      <p className="font-mono font-semibold text-brand-700">{tc.name}</p>
                      <pre className="text-[10px] mt-1 overflow-x-auto">
                        {JSON.stringify(tc.input, null, 2)}
                      </pre>
                      {tc.result && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-brand-500">
                            Sonuç ({Array.isArray(tc.result?.rows) ? `${tc.result.rows.length} satır` : 'JSON'})
                          </summary>
                          <pre className="text-[10px] mt-1 overflow-x-auto max-h-40">
                            {JSON.stringify(tc.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
