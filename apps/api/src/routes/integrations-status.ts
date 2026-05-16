/**
 * /v1/integrations/status — entegrasyon panosu için durum raporu.
 *
 * Frontend bu endpoint'i çağırır + her servisin "configured/healthy/unconfigured"
 * durumunu kullanıcıya gösterir. Test/edit aksiyonları diğer endpoint'lerden gider.
 *
 * Auth: requireOrg (admin değil — herkes görebilir, ama edit etmek için admin gerekli).
 */
import { Router } from 'express';
import { env, isConfigured } from '../config/env';
import { requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const integrationsStatusRouter = Router();

interface IntegrationStatus {
  key: string;
  name: string;
  category: 'communication' | 'ai' | 'integration' | 'observability' | 'infra';
  configured: boolean;
  description: string;
  env_keys: string[];
  /** Env yok ise UI gizli setup yönergesi gösterir */
  setup_hint?: string;
}

integrationsStatusRouter.get(
  '/integrations/status',
  requireAuth,
  requireOrg,
  async (_req, res, next) => {
    try {
    const integrations: IntegrationStatus[] = [
      {
        key: 'resend',
        name: 'Resend (E-posta)',
        category: 'communication',
        configured: isConfigured.email,
        description:
          'Bildirim, fatura hatırlatma ve davet e-postaları için kullanılır. Verify edilmiş alan adı zorunludur.',
        env_keys: ['RESEND_API_KEY', 'EMAIL_FROM'],
        setup_hint:
          'resend.com/api-keys → API key + Verified Domains → noreply@sayman.deploi.net',
      },
      {
        key: 'telegram',
        name: 'Telegram Bot',
        category: 'communication',
        configured: isConfigured.telegram,
        description:
          'Bireysel kullanıcılara push gibi anında bildirim. /security sayfasından chat_id eşlenir.',
        env_keys: ['TELEGRAM_BOT_TOKEN'],
        setup_hint: '@BotFather → /newbot → token alı',
      },
      {
        key: 'whatsapp',
        name: 'WhatsApp Business',
        category: 'communication',
        configured: isConfigured.whatsapp,
        description:
          'Müşteri/tedarikçi mesajlaşması ve fatura hatırlatma. Meta Cloud API kullanır.',
        env_keys: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
        setup_hint:
          'developers.facebook.com → WhatsApp Business App → Permanent token + phone_number_id',
      },
      {
        key: 'claude',
        name: 'Claude AI (Anthropic)',
        category: 'ai',
        configured: isConfigured.ai,
        description:
          'Doğal dil sorgu (/ai), günlük özet, anomali açıklama. claude-haiku-4-5-20251001 modeli kullanılır.',
        env_keys: ['ANTHROPIC_API_KEY'],
        setup_hint: 'console.anthropic.com/keys → API Keys → Create',
      },
      {
        key: 'voyage',
        name: 'Voyage AI (Embeddings)',
        category: 'ai',
        configured: isConfigured.embeddings,
        description:
          'Anlamsal arama için fatura içeriklerini vektörlere çevirir. pgvector ile birlikte çalışır.',
        env_keys: ['VOYAGE_API_KEY'],
        setup_hint: 'dash.voyageai.com → API Keys (voyage-3-lite önerilir, 1024 boyut)',
      },
      {
        key: 'sentry',
        name: 'Sentry (Hata Takibi)',
        category: 'observability',
        configured: isConfigured.sentry,
        description: 'Production hatalarını ve performans regresyonlarını yakalar.',
        env_keys: ['SENTRY_DSN'],
        setup_hint: 'sentry.io → Settings → Projects → Client Keys (DSN)',
      },
      {
        key: 'supabase',
        name: 'Supabase Auth + Storage',
        category: 'infra',
        configured: isConfigured.supabase,
        description:
          'SSO/OAuth login, dosya saklama (faturalara ek). Olmadan local password ile çalışır ama OAuth devre dışı kalır.',
        env_keys: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        setup_hint: 'supabase.com/dashboard → Settings → API',
      },
      {
        key: 'webhooks_outbound',
        name: 'Giden Webhooks',
        category: 'integration',
        configured: true,
        description:
          'Sayman olayları (fatura, ödeme, anomali) dış sistemlere POST eder. /webhooks sayfasından yönet.',
        env_keys: [],
      },
      {
        key: 'webhooks_inbound',
        name: 'Gelen Webhooks',
        category: 'integration',
        configured: true,
        description:
          'Damga, n8n, Zapier gibi sistemler /v1/inbound/:slug ile fatura/event gönderebilir. HMAC-SHA256 imza zorunlu.',
        env_keys: [],
      },
      {
        key: 'api_tokens',
        name: 'API Tokenları',
        category: 'integration',
        configured: true,
        description: 'Programatik erişim için Bearer token oluşturma. Kapsam (scope) ve süreyi seç.',
        env_keys: [],
      },
      {
        key: 'fx_rates',
        name: 'TCMB Döviz Kurları',
        category: 'integration',
        configured: true,
        description:
          'Her gün 16:00 TR\'de TCMB XML\'den güncel kur çeker. USD/EUR/GBP destekli.',
        env_keys: [],
      },
      {
        key: 'erp_integration',
        name: 'ERP / Muhasebe Yazılımı Bağlantısı',
        category: 'integration',
        configured: true,
        description:
          'Paraşüt, Logo, Mikro gibi muhasebe yazılımlarıyla cari hesap + ekstre senkronizasyonu. Saatlik otomatik sync.',
        env_keys: [],
      },
    ];

    res.json({ data: integrations, meta: { env_has_db: Boolean(env.DATABASE_URL) } });
    } catch (err) {
      next(err);
    }
  },
);
