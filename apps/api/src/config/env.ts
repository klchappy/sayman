import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// .env workspace root'ta — buradan iki dizin yukarı (apps/api/src/config → ../../../../.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4300),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL gerekli'),
  CLIENT_URL: z.string().url().default('http://localhost:5278'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET en az 16 karakter olmalı'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Supabase Auth (opsiyonel — yapılandırılmazsa /v1/me 503 döner)
  // preprocess: .env'deki boş string ('') → undefined (yoksay)
  SUPABASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  // SANTRAL hibrit refactor — auth + encryption
  /** AES-GCM key derivation için ayrı bir secret (verilmezse JWT_SECRET kullanılır) */
  ENCRYPTION_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(32).optional(),
  ),
  /** Platform admin email (boot-time idempotent seed için) */
  PLATFORM_ADMIN_EMAIL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().email().optional(),
  ),
  PLATFORM_ADMIN_NAME: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(2).optional(),
  ),
  /** Reset password linki için frontend base URL — production: https://sayman.deploi.net */
  PUBLIC_WEB_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),

  /** Resend e-posta gateway (opsiyonel — yapılandırılmazsa fallback_link mode) */
  RESEND_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(10).optional(),
  ),
  /** Gönderen adresi — Resend'de verify edilmiş domain'den. Örn: noreply@sayman.deploi.net */
  EMAIL_FROM: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().email().optional(),
  ),

  /** Telegram Bot API token — @BotFather'dan alınır (örn: 123456:ABC...) */
  TELEGRAM_BOT_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /** Sentry error tracking — sentry.io/settings → projects → DSN */
  SENTRY_DSN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),

  /** Anthropic Claude API key (AI asistan için) — sk-ant-... */
  ANTHROPIC_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /** WhatsApp Business Cloud API access token — Meta developers'dan alınır */
  WHATSAPP_ACCESS_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),
  /** Meta phone_number_id — Meta business account altındaki numara */
  WHATSAPP_PHONE_NUMBER_ID: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(5).optional(),
  ),

  /** OpenAI — embeddings (text-embedding-3-small, dim=1024) + chat (gpt-4o-mini default) */
  OPENAI_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /** DeepSeek chat (deepseek-chat, deepseek-reasoner) — OpenAI-uyumlu API */
  DEEPSEEK_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /** Grok (xAI) chat (grok-2, grok-2-mini) — OpenAI-uyumlu API */
  GROK_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /** Google Gemini (gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro) */
  GEMINI_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(20).optional(),
  ),

  /**
   * AI provider seçimi (chat için). Embeddings her zaman OpenAI.
   * Default: 'claude'. UI'dan değiştirilebilir.
   */
  AI_CHAT_PROVIDER: z
    .enum(['claude', 'openai', 'deepseek', 'grok', 'gemini'])
    .default('claude'),

  /** WhatsApp webhook doğrulama token (Meta sets, biz match ederiz) */
  WHATSAPP_VERIFY_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(8).optional(),
  ),

  /** WhatsApp App Secret — POST /whatsapp/inbound için x-hub-signature-256 doğrulama */
  WHATSAPP_APP_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(8).optional(),
  ),

  /** Upstash Redis — cluster-safe rate limit için (yoksa in-memory fallback) */
  UPSTASH_REDIS_REST_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(10).optional(),
  ),
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

export const isConfigured = {
  db: Boolean(env.DATABASE_URL),
  supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
  sentry: Boolean(env.SENTRY_DSN),
  ai: Boolean(env.ANTHROPIC_API_KEY),
  openai: Boolean(env.OPENAI_API_KEY),
  deepseek: Boolean(env.DEEPSEEK_API_KEY),
  grok: Boolean(env.GROK_API_KEY),
  gemini: Boolean(env.GEMINI_API_KEY),
  whatsapp: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
  // Embeddings: OpenAI tabanlı (text-embedding-3-small, dim=1024)
  embeddings: Boolean(env.OPENAI_API_KEY),
  upstashRedis: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
};
