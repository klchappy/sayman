/**
 * /v1/integrations/status — entegrasyon panosu için durum raporu.
 *
 * Frontend bu endpoint'i çağırır + her servisin "configured/healthy/unconfigured"
 * durumunu kullanıcıya gösterir. Test/edit aksiyonları diğer endpoint'lerden gider.
 *
 * Ayrıca:
 *   GET  /v1/integrations/ai-chat-provider  → org'un chat provider seçimi
 *   PUT  /v1/integrations/ai-chat-provider  → seçimi güncelle (admin)
 *
 * Auth: requireOrg (admin değil — herkes görebilir, ama edit etmek için admin gerekli).
 */
import { eq, and, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, integrationCredentials } from '@sayman/db';
import { env, isConfigured } from '../config/env';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
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
        name: 'Claude (Anthropic) — Chat',
        category: 'ai',
        configured: isConfigured.ai,
        description:
          'Doğal dil sorgu (/ai asistan), günlük özet, anomali açıklama. claude-haiku-4-5-20251001 default. Tool-use destekli (Sayman AI asistanı bu provider üzerinden çalışır).',
        env_keys: ['ANTHROPIC_API_KEY'],
        setup_hint: 'console.anthropic.com/keys → API Keys → Create',
      },
      {
        key: 'openai',
        name: 'OpenAI — Chat + Embeddings',
        category: 'ai',
        configured: isConfigured.openai,
        description:
          'Hem embeddings (anlamsal arama, text-embedding-3-small 1024d) hem chat (gpt-4o-mini default). Embeddings için ZORUNLU, chat için isteğe bağlı (provider seçimi UI\'dan).',
        env_keys: ['OPENAI_API_KEY'],
        setup_hint: 'platform.openai.com/api-keys → Create new secret key',
      },
      {
        key: 'deepseek',
        name: 'DeepSeek — Chat',
        category: 'ai',
        configured: isConfigured.deepseek,
        description:
          'Açık kaynak alternatifi düşük maliyet. deepseek-chat ve deepseek-reasoner modelleri. OpenAI-uyumlu API. Chat provider olarak seçilirse kullanılır.',
        env_keys: ['DEEPSEEK_API_KEY'],
        setup_hint: 'platform.deepseek.com/api_keys → Create API Key',
      },
      {
        key: 'grok',
        name: 'Grok (xAI) — Chat',
        category: 'ai',
        configured: isConfigured.grok,
        description:
          'xAI grok-2-1212 ve grok-2-mini. OpenAI-uyumlu API. Chat provider olarak seçilirse kullanılır.',
        env_keys: ['GROK_API_KEY'],
        setup_hint: 'console.x.ai → API Keys → Create',
      },
      {
        key: 'gemini',
        name: 'Google Gemini — Chat',
        category: 'ai',
        configured: isConfigured.gemini,
        description:
          'gemini-2.0-flash ve gemini-1.5-pro. Multimodal (gelecekte resim/PDF input için kullanılacak). Chat provider olarak seçilirse kullanılır.',
        env_keys: ['GEMINI_API_KEY'],
        setup_hint: 'aistudio.google.com/apikey → Create API Key',
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

/**
 * GET /v1/integrations/ai-chat-provider — Org'un seçili chat provider'ını döner.
 * Lookup: org integration_credentials → env.AI_CHAT_PROVIDER → 'claude'.
 */
integrationsStatusRouter.get(
  '/integrations/ai-chat-provider',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .select()
        .from(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.organization_id, req.activeOrgId!),
            eq(integrationCredentials.integration_key, 'ai_chat_provider'),
            sql`${integrationCredentials.tenant_id} IS NULL`,
            eq(integrationCredentials.is_active, true),
          ),
        );
      const creds = (row?.credentials ?? {}) as { provider?: string };
      const provider =
        (creds.provider && ['claude', 'openai', 'deepseek', 'grok', 'gemini'].includes(creds.provider)
          ? creds.provider
          : env.AI_CHAT_PROVIDER) ?? 'claude';
      res.json({ data: { provider } });
    } catch (err) {
      next(err);
    }
  },
);

const setProviderSchema = z.object({
  provider: z.enum(['claude', 'openai', 'deepseek', 'grok', 'gemini']),
});

/**
 * PUT /v1/integrations/ai-chat-provider — Org'un chat provider seçimini günceller.
 * Sadece admin'ler değiştirebilir.
 */
integrationsStatusRouter.put(
  '/integrations/ai-chat-provider',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin', 'yonetici'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'AI provider değiştirmek için yönetici yetkisi gerekli', 'FORBIDDEN');
      }
      const { provider } = setProviderSchema.parse(req.body);
      const db = getDb();

      // Upsert org-level credential
      const [existing] = await db
        .select({ id: integrationCredentials.id })
        .from(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.organization_id, req.activeOrgId!),
            eq(integrationCredentials.integration_key, 'ai_chat_provider'),
            sql`${integrationCredentials.tenant_id} IS NULL`,
          ),
        );

      if (existing) {
        await db
          .update(integrationCredentials)
          .set({
            credentials: { provider },
            is_active: true,
            updated_at: new Date(),
          })
          .where(eq(integrationCredentials.id, existing.id));
      } else {
        await db.insert(integrationCredentials).values({
          organization_id: req.activeOrgId!,
          tenant_id: null,
          integration_key: 'ai_chat_provider',
          credentials: { provider },
          created_by: req.authUser?.id ?? null,
        });
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'integration.ai_chat_provider.set',
        target_type: 'integration_credentials',
        target_id: null,
        details: { provider },
      });

      res.json({ data: { provider, ok: true } });
    } catch (err) {
      next(err);
    }
  },
);
