/**
 * AI provider abstraction — Claude, OpenAI, DeepSeek, Grok, Gemini.
 *
 * Simple text-in/text-out generation. Tool-use (function calling) ai-assistant.ts
 * altında Claude'a özel kalır (4 farklı sağlayıcı tool format'ını eşit destekleyene
 * kadar simple metin yanıtları için bu abstraction yeterli).
 *
 * Seçim sırası:
 *  1) Function arg `provider` override
 *  2) Org/tenant integration credentials (integration_key='ai_chat_provider')
 *  3) env.AI_CHAT_PROVIDER
 *  4) 'claude' (default)
 *
 * API key seçim sırası (her provider için):
 *  1) Org/tenant integration credentials (integration_key=<provider>)
 *  2) env.<PROVIDER>_API_KEY
 *  3) null → 503 hata
 */
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getCredentialField } from './integration-credentials';
import { HttpError } from './helpers';

export type ChatProvider = 'claude' | 'openai' | 'deepseek' | 'grok' | 'gemini';

export interface AiCtx {
  organizationId?: string | null;
  tenantId?: string | null;
  provider?: ChatProvider; // override
}

export interface GenerateOpts {
  system?: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: ChatProvider;
  inputTokens?: number;
  outputTokens?: number;
}

const DEFAULT_TIMEOUT = 45_000;
const DEFAULT_MAX_TOKENS = 1024;

const PROVIDER_DEFAULT_MODEL: Record<ChatProvider, string> = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  grok: 'grok-2-1212',
  gemini: 'gemini-2.0-flash',
};

async function resolveApiKey(
  ctx: AiCtx | undefined,
  provider: ChatProvider,
): Promise<string | null> {
  const envKey: string | undefined =
    provider === 'claude'
      ? env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? env.OPENAI_API_KEY
        : provider === 'deepseek'
          ? env.DEEPSEEK_API_KEY
          : provider === 'grok'
            ? env.GROK_API_KEY
            : env.GEMINI_API_KEY;

  if (ctx?.organizationId) {
    const r = await getCredentialField(
      {
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId ?? null,
        integrationKey: provider,
      },
      'api_key',
      envKey,
    );
    return r.value;
  }
  return envKey ?? null;
}

async function resolveProvider(ctx?: AiCtx): Promise<ChatProvider> {
  if (ctx?.provider) return ctx.provider;
  if (ctx?.organizationId) {
    // Org-level chat provider preference
    const r = await getCredentialField(
      {
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId ?? null,
        integrationKey: 'ai_chat_provider',
      },
      'provider',
      env.AI_CHAT_PROVIDER,
    );
    if (
      r.value &&
      ['claude', 'openai', 'deepseek', 'grok', 'gemini'].includes(r.value)
    ) {
      return r.value as ChatProvider;
    }
  }
  return env.AI_CHAT_PROVIDER as ChatProvider;
}

export async function generateText(
  opts: GenerateOpts,
  ctx?: AiCtx,
): Promise<GenerateResult> {
  const provider = await resolveProvider(ctx);
  const apiKey = await resolveApiKey(ctx, provider);
  if (!apiKey) {
    throw new HttpError(
      503,
      `${provider} AI yapılandırılmamış (API key yok)`,
      'AI_NOT_CONFIGURED',
    );
  }

  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const model = PROVIDER_DEFAULT_MODEL[provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    switch (provider) {
      case 'claude':
        return await callClaude({ apiKey, model, maxTokens, opts, signal: controller.signal });
      case 'openai':
      case 'deepseek':
      case 'grok':
        return await callOpenAICompat({
          apiKey,
          model,
          maxTokens,
          opts,
          signal: controller.signal,
          provider,
        });
      case 'gemini':
        return await callGemini({ apiKey, model, maxTokens, opts, signal: controller.signal });
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new HttpError(
        504,
        `AI yanıtı çok uzun sürdü (${timeout / 1000}s timeout)`,
        'AI_TIMEOUT',
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Provider adapters ----------

async function callClaude(args: {
  apiKey: string;
  model: string;
  maxTokens: number;
  opts: GenerateOpts;
  signal: AbortSignal;
}): Promise<GenerateResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: args.signal,
    headers: {
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.opts.system,
      messages: [{ role: 'user', content: args.opts.prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error({ status: res.status, txt: txt.slice(0, 200) }, 'claude api error');
    throw new HttpError(500, `Claude API hatası: ${txt.slice(0, 200)}`, 'AI_FAIL');
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    model: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');

  return {
    text,
    model: data.model,
    provider: 'claude',
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  };
}

/**
 * OpenAI + uyumlu API'ler (DeepSeek, Grok) için ortak adapter.
 * DeepSeek: https://api.deepseek.com/v1/chat/completions
 * Grok: https://api.x.ai/v1/chat/completions
 * OpenAI: https://api.openai.com/v1/chat/completions
 */
async function callOpenAICompat(args: {
  apiKey: string;
  model: string;
  maxTokens: number;
  opts: GenerateOpts;
  signal: AbortSignal;
  provider: 'openai' | 'deepseek' | 'grok';
}): Promise<GenerateResult> {
  const baseUrl =
    args.provider === 'openai'
      ? 'https://api.openai.com/v1'
      : args.provider === 'deepseek'
        ? 'https://api.deepseek.com/v1'
        : 'https://api.x.ai/v1';

  const messages: Array<{ role: string; content: string }> = [];
  if (args.opts.system) messages.push({ role: 'system', content: args.opts.system });
  messages.push({ role: 'user', content: args.opts.prompt });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: args.signal,
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error(
      { provider: args.provider, status: res.status, txt: txt.slice(0, 200) },
      'openai-compat api error',
    );
    throw new HttpError(
      500,
      `${args.provider} API hatası: ${txt.slice(0, 200)}`,
      'AI_FAIL',
    );
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content?: string } }>;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices[0]?.message?.content ?? '';

  return {
    text,
    model: data.model,
    provider: args.provider,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}

/**
 * Google Gemini API: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */
async function callGemini(args: {
  apiKey: string;
  model: string;
  maxTokens: number;
  opts: GenerateOpts;
  signal: AbortSignal;
}): Promise<GenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${args.apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: args.opts.prompt }] }],
    generationConfig: {
      maxOutputTokens: args.maxTokens,
    },
  };
  if (args.opts.system) {
    body.systemInstruction = { parts: [{ text: args.opts.system }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    signal: args.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error({ status: res.status, txt: txt.slice(0, 200) }, 'gemini api error');
    throw new HttpError(500, `Gemini API hatası: ${txt.slice(0, 200)}`, 'AI_FAIL');
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  return {
    text,
    model: args.model,
    provider: 'gemini',
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
  };
}

/**
 * Provider için "hazır mı?" kontrolü. Frontend status panosu için.
 */
export function isProviderConfigured(provider: ChatProvider): boolean {
  switch (provider) {
    case 'claude':
      return Boolean(env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(env.OPENAI_API_KEY);
    case 'deepseek':
      return Boolean(env.DEEPSEEK_API_KEY);
    case 'grok':
      return Boolean(env.GROK_API_KEY);
    case 'gemini':
      return Boolean(env.GEMINI_API_KEY);
  }
}

export function activeChatProvider(): ChatProvider {
  return env.AI_CHAT_PROVIDER as ChatProvider;
}

export const ALL_CHAT_PROVIDERS: ChatProvider[] = [
  'claude',
  'openai',
  'deepseek',
  'grok',
  'gemini',
];

export const PROVIDER_LABELS: Record<ChatProvider, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI GPT',
  deepseek: 'DeepSeek',
  grok: 'Grok (xAI)',
  gemini: 'Google Gemini',
};
