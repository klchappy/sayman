/**
 * /integrations — Entegrasyon Hub (Santral style).
 *
 * Tüm 3rd-party + iç entegrasyonların durumu, kısa açıklama,
 * setup yönergesi ve sayfaya derin link (varsa).
 *
 * Backend: GET /v1/integrations/status — env durumlarını döner.
 * Kategorize (communication, ai, observability, integration, infra).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  Bot,
  Brain,
  CheckCircle2,
  Cloud,
  Database,
  DollarSign,
  ExternalLink,
  Hexagon,
  Key,
  Mail,
  MessageCircle,
  Plug,
  ScanLine,
  Search,
  Send,
  Shield,
  Sparkles,
  TestTube2,
  Webhook,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface IntegrationStatus {
  key: string;
  name: string;
  category: 'communication' | 'ai' | 'integration' | 'observability' | 'infra';
  configured: boolean;
  description: string;
  env_keys: string[];
  setup_hint?: string;
}

const CATEGORY_LABELS: Record<IntegrationStatus['category'], string> = {
  communication: 'İletişim Kanalları',
  ai: 'Yapay Zeka',
  observability: 'Gözlemlenebilirlik',
  integration: 'Entegrasyonlar',
  infra: 'Altyapı',
};

const CATEGORY_ORDER: IntegrationStatus['category'][] = [
  'ai',
  'communication',
  'integration',
  'observability',
  'infra',
];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  resend: Mail,
  telegram: Send,
  whatsapp: MessageCircle,
  claude: Sparkles,
  voyage: Brain,
  sentry: Shield,
  supabase: Cloud,
  webhooks_outbound: Webhook,
  webhooks_inbound: Webhook,
  api_tokens: Key,
  fx_rates: DollarSign,
  erp_integration: Database,
};

const LINKS: Record<string, string> = {
  resend: '/security',
  telegram: '/security',
  webhooks_outbound: '/security',
  webhooks_inbound: '/integrations/inbound-webhooks',
  api_tokens: '/security',
  claude: '/ai',
  erp_integration: '/erp',
};

export function IntegrationsPage() {
  const q = useQuery({
    queryKey: ['integrations-status'],
    queryFn: async () => {
      const res = await api.get<{ data: IntegrationStatus[] }>('/integrations/status');
      return res.data.data;
    },
  });

  const grouped = (q.data ?? []).reduce<Record<string, IntegrationStatus[]>>((acc, x) => {
    (acc[x.category] ??= []).push(x);
    return acc;
  }, {});

  const counts = (q.data ?? []).reduce(
    (acc, x) => {
      if (x.configured) acc.active++;
      else acc.inactive++;
      return acc;
    },
    { active: 0, inactive: 0 },
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Sistem</p>
        <h1 className="text-2xl font-semibold text-brand-900 flex items-center gap-2">
          <Plug className="size-6" />
          Entegrasyon Hub'ı
        </h1>
        <p className="text-sm text-brand-500 mt-1">
          Tüm dış servislerin tek elden yönetimi. Bir entegrasyon "Yapılandırılmadı" gözüküyorsa{' '}
          <code className="font-mono text-xs bg-brand-100 px-1 py-0.5 rounded">.env</code> dosyasına
          ilgili anahtarları ekle ve API'yi yeniden başlat.
        </p>
      </header>

      {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}

      {q.data && (
        <>
          {/* Summary bar */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="card bg-emerald-50 border-emerald-200">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Aktif</p>
              <p className="text-2xl font-semibold text-emerald-900">{counts.active}</p>
              <p className="text-xs text-emerald-700 mt-1">entegrasyon yapılandırıldı</p>
            </div>
            <div className="card bg-amber-50 border-amber-200">
              <p className="text-xs uppercase tracking-wide text-amber-700">Pasif</p>
              <p className="text-2xl font-semibold text-amber-900">{counts.inactive}</p>
              <p className="text-xs text-amber-700 mt-1">opsiyonel — istenirse açılır</p>
            </div>
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-xs uppercase tracking-wide text-blue-700">Toplam</p>
              <p className="text-2xl font-semibold text-blue-900">{q.data.length}</p>
              <p className="text-xs text-blue-700 mt-1">desteklenen entegrasyon</p>
            </div>
          </div>

          {/* Kategoriler */}
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-sm uppercase tracking-wider text-brand-500 mb-3">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {items.map((it) => (
                    <IntegrationCard key={it.key} item={it} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function IntegrationCard({ item }: { item: IntegrationStatus }) {
  const Icon = ICONS[item.key] ?? Hexagon;
  const link = LINKS[item.key];
  const [showWaTest, setShowWaTest] = useState(false);
  const isTestable = item.key === 'whatsapp' && item.configured;

  return (
    <div
      className={`card transition hover:shadow-md ${
        item.configured ? 'border-emerald-200 bg-white' : 'border-brand-100 bg-brand-50/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-10 grid place-items-center rounded-lg ${
            item.configured
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-brand-100 text-brand-500'
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-brand-900 truncate">{item.name}</h3>
            {item.configured ? (
              <span className="text-xs flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Aktif
              </span>
            ) : (
              <span className="text-xs flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertCircle className="size-3" />
                Pasif
              </span>
            )}
          </div>
          <p className="text-sm text-brand-600 mb-3">{item.description}</p>

          {item.env_keys.length > 0 && (
            <div className="text-[10px] mb-3">
              <span className="text-brand-400 uppercase tracking-wide">
                Env keys ({item.configured ? 'set' : 'gerekli'}):
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.env_keys.map((k) => (
                  <code
                    key={k}
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      item.configured
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-brand-50 text-brand-600 border border-brand-200'
                    }`}
                  >
                    {k}
                  </code>
                ))}
              </div>
            </div>
          )}

          {!item.configured && item.setup_hint && (
            <p className="text-xs bg-blue-50 border border-blue-100 rounded p-2 mb-3 text-blue-800">
              💡 {item.setup_hint}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {link && (
              <Link
                to={link}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-medium"
              >
                Yönet
                <ExternalLink className="size-3" />
              </Link>
            )}
            {isTestable && (
              <button
                onClick={() => setShowWaTest(true)}
                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
              >
                <TestTube2 className="size-3" />
                Test Mesajı
              </button>
            )}
          </div>
        </div>
      </div>

      {showWaTest && <WhatsAppTestModal onClose={() => setShowWaTest(false)} />}
    </div>
  );
}

function WhatsAppTestModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState('');
  const [text, setText] = useState('Sayman test mesajı.');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { delivered: boolean; message_id?: string | null } }>(
        '/whatsapp/test',
        { to, text },
      )).data.data,
    onSuccess: (r) => {
      setResult({
        ok: r.delivered,
        msg: r.delivered ? `Gönderildi (id: ${r.message_id ?? '-'})` : 'Teslim edilemedi.',
      });
    },
    onError: (e) => setResult({ ok: false, msg: (e as Error).message }),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            WhatsApp Test Mesajı
          </h3>
          <button onClick={onClose} className="text-brand-500 hover:text-brand-900">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
              Alıcı Numara (E.164)
            </label>
            <input
              type="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="905xxxxxxxxx"
              className="input w-full mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-brand-500 dark:text-slate-400 uppercase tracking-wide">
              Mesaj
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={1000}
              className="input w-full mt-1"
            />
          </div>
          {result && (
            <div
              className={`text-sm p-3 rounded ${
                result.ok
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              {result.msg}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50 rounded"
            >
              Kapat
            </button>
            <button
              onClick={() => send.mutate()}
              disabled={!to || !text || send.isPending}
              className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
            >
              {send.isPending ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
