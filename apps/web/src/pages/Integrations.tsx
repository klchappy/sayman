/**
 * /integrations — Sayman Entegrasyon Merkezi
 *
 * Tasarım: Santral kategorik grid + Etik KPI bar + gradient stripe + 2-button row.
 * Backend: GET /v1/integrations/status — env durumlarını döner.
 *
 * Kategoriler: ai · communication · integration · observability · infra
 * Her kart: gradient stripe (kategoriye göre renk) + ikon + başlık + durum rozeti
 *   + açıklama + env_keys pill + 2 buton (Yapılandır + Belgeler/Test)
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
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
  Send,
  Settings,
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
  ai: 'Yapay Zeka',
  communication: 'İletişim Kanalları',
  integration: 'Sistem Entegrasyonları',
  observability: 'Gözlemlenebilirlik',
  infra: 'Altyapı',
};

const CATEGORY_DESCRIPTIONS: Record<IntegrationStatus['category'], string> = {
  ai: 'Sağlayıcıyı seç, API anahtarını yapıştır. Model adları ve maliyet hesabı otomatik.',
  communication: 'Müşteri ve içerideki kullanıcılarla iletişim için kullanılan kanallar.',
  integration: 'ERP, e-fatura ve harici sistemlerle veri akışı.',
  observability: 'Hata izleme, performans, audit log ve operasyonel görünürlük.',
  infra: 'Veritabanı, dosya depolama, kimlik doğrulama altyapısı.',
};

const CATEGORY_ORDER: IntegrationStatus['category'][] = [
  'ai',
  'communication',
  'integration',
  'observability',
  'infra',
];

// Sol kenar gradient stripe rengi (Etik tarzı)
const CATEGORY_STRIPE: Record<IntegrationStatus['category'], string> = {
  ai: 'from-purple-500 via-fuchsia-500 to-pink-500',
  communication: 'from-blue-500 via-sky-500 to-cyan-500',
  integration: 'from-emerald-500 via-green-500 to-teal-500',
  observability: 'from-amber-500 via-orange-500 to-yellow-500',
  infra: 'from-slate-500 via-zinc-500 to-gray-500',
};

const CATEGORY_ICON_BG: Record<IntegrationStatus['category'], string> = {
  ai: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  communication: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  integration: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  observability: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  infra: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
};

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

const DOC_URLS: Record<string, string> = {
  resend: 'https://resend.com/docs',
  telegram: 'https://core.telegram.org/bots/api',
  whatsapp: 'https://developers.facebook.com/docs/whatsapp',
  claude: 'https://docs.anthropic.com',
  voyage: 'https://docs.voyageai.com',
  sentry: 'https://docs.sentry.io',
  supabase: 'https://supabase.com/docs',
  webhooks_outbound: 'https://sayman.deploi.net/integrations',
  webhooks_inbound: 'https://sayman.deploi.net/integrations/inbound-webhooks',
  fx_rates: 'https://www.tcmb.gov.tr',
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
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-brand-500 mb-1">Sistem</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
          <Plug className="size-7 text-brand-700 dark:text-brand-300" />
          Entegrasyon Merkezi
        </h1>
        <p className="text-sm text-brand-500 dark:text-slate-400 mt-1 max-w-2xl">
          Tüm 3rd-party servisler tek yerden — durum, kurulum, test ve dokümantasyon. Bir entegrasyon
          "Pasif" gözüküyorsa ilgili env anahtarları{' '}
          <code className="font-mono text-[11px] bg-brand-100 dark:bg-slate-800 px-1 py-0.5 rounded">
            .env
          </code>{' '}
          dosyasına eklenmeli ve API yeniden başlatılmalı.
        </p>
      </header>

      {q.isLoading && (
        <div className="grid sm:grid-cols-3 gap-4 mb-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-brand-100 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {q.data && (
        <>
          {/* KPI Bar (Etik tarzı) */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <KpiCard
              label="Aktif"
              value={counts.active}
              total={q.data.length}
              color="emerald"
              hint="entegrasyon yapılandırıldı"
            />
            <KpiCard
              label="Pasif"
              value={counts.inactive}
              color="amber"
              hint="opsiyonel — istenirse açılır"
            />
            <KpiCard
              label="Toplam"
              value={q.data.length}
              color="blue"
              hint="desteklenen entegrasyon"
            />
          </div>

          {/* Kategori grupları (Santral tarzı) */}
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat] ?? [];
            if (items.length === 0) return null;
            const ConfiguredCount = items.filter((i) => i.configured).length;
            return (
              <section key={cat} className="mb-10">
                <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
                      <CategoryIcon category={cat} />
                      {CATEGORY_LABELS[cat]}
                      <span className="text-xs font-normal text-brand-400">
                        {ConfiguredCount}/{items.length}
                      </span>
                    </h2>
                    <p className="text-xs text-brand-500 dark:text-slate-400 mt-1">
                      {CATEGORY_DESCRIPTIONS[cat]}
                    </p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
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

function KpiCard({
  label,
  value,
  total,
  color,
  hint,
}: {
  label: string;
  value: number;
  total?: number;
  color: 'emerald' | 'amber' | 'blue';
  hint: string;
}) {
  const colors = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-[11px] uppercase tracking-wider font-medium opacity-80">{label}</p>
      <p className="text-3xl font-semibold mt-1">
        {value}
        {total !== undefined && (
          <span className="text-base font-normal opacity-60">/{total}</span>
        )}
      </p>
      <p className="text-xs mt-1 opacity-70">{hint}</p>
    </div>
  );
}

function CategoryIcon({ category }: { category: IntegrationStatus['category'] }) {
  const map: Record<IntegrationStatus['category'], React.ComponentType<{ className?: string }>> = {
    ai: Sparkles,
    communication: Send,
    integration: Database,
    observability: Shield,
    infra: Cloud,
  };
  const Icon = map[category];
  return <Icon className="size-5 text-brand-500" />;
}

function IntegrationCard({ item }: { item: IntegrationStatus }) {
  const Icon = ICONS[item.key] ?? Hexagon;
  const link = LINKS[item.key];
  const docUrl = DOC_URLS[item.key];
  const isTestable = item.key === 'whatsapp' && item.configured;
  const [showWaTest, setShowWaTest] = useState(false);

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-brand-100 dark:border-slate-800 overflow-hidden hover:shadow-md transition-shadow">
      {/* Sol gradient stripe (Etik tarzı) */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${CATEGORY_STRIPE[item.category]}`}
      />

      <div className="p-5 pl-6">
        {/* Header: ikon + başlık + durum */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`size-11 grid place-items-center rounded-lg shrink-0 ${CATEGORY_ICON_BG[item.category]}`}
          >
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-brand-900 dark:text-slate-100 leading-tight">
                {item.name}
              </h3>
              {item.configured ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="size-3" />
                  AKTİF
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                  <AlertCircle className="size-3" />
                  PASİF
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Açıklama */}
        <p className="text-sm text-brand-600 dark:text-slate-400 mb-3 leading-relaxed">
          {item.description}
        </p>

        {/* Env keys pill'ler */}
        {item.env_keys.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wide text-brand-400 mb-1">
              Env Anahtarları ({item.configured ? 'tanımlı' : 'eksik'})
            </p>
            <div className="flex flex-wrap gap-1">
              {item.env_keys.map((k) => (
                <code
                  key={k}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                    item.configured
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-slate-400 border-brand-200 dark:border-slate-700'
                  }`}
                >
                  {k}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Setup hint */}
        {!item.configured && item.setup_hint && (
          <div className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 mb-3 text-blue-800 dark:text-blue-300">
            💡 {item.setup_hint}
          </div>
        )}

        {/* Action row (Etik tarzı 2-buton) */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {link ? (
            <Link
              to={link}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-900 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg"
            >
              <Settings className="size-3.5" />
              Yapılandır
            </Link>
          ) : item.configured ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 px-3 py-1.5">
              <CheckCircle2 className="size-3.5" />
              Yapılandırılmış
            </span>
          ) : null}

          {isTestable && (
            <button
              onClick={() => setShowWaTest(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-brand-200 dark:border-slate-700 text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg"
            >
              <TestTube2 className="size-3.5" />
              Test Et
            </button>
          )}

          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-brand-200 dark:border-slate-700 text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg ml-auto"
            >
              Belgeler
              <ExternalLink className="size-3" />
            </a>
          )}
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
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
              className="px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50 dark:hover:bg-slate-700 rounded"
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
