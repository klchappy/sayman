/**
 * Embeddings wrapper — OpenAI text-embedding-3-small (dim=1024).
 *
 * Env yoksa (OPENAI_API_KEY): no-op, kullanıcı dostu hata
 * Env varsa: text-embedding-3-small `dimensions=1024` ile metin → vektör
 *
 * Maliyet: $0.02 / 1M token. 10000 fatura ≈ $0.001.
 * Türkçe multilingual destek.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getCredentialField } from './integration-credentials';

const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const OPENAI_EMBED_DIM = 1024;

export interface EmbedResult {
  embedding: number[];
  model: string;
  tokens: number;
}

export interface EmbedCtx {
  organizationId?: string | null;
  tenantId?: string | null;
}

async function resolveOpenAIKey(ctx?: EmbedCtx): Promise<string | null> {
  if (ctx?.organizationId) {
    const r = await getCredentialField(
      {
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        integrationKey: 'openai',
      },
      'api_key',
      env.OPENAI_API_KEY,
    );
    return r.value;
  }
  return env.OPENAI_API_KEY ?? null;
}

export async function embedText(text: string, ctx?: EmbedCtx): Promise<EmbedResult | null> {
  const apiKey = await resolveOpenAIKey(ctx);
  if (!apiKey) {
    logger.debug('embed: OPENAI_API_KEY not set, skipping');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input: text.slice(0, 8000),
        dimensions: OPENAI_EMBED_DIM,
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      logger.warn({ status: res.status, errTxt: errTxt.slice(0, 200) }, 'openai embed error');
      return null;
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== OPENAI_EMBED_DIM) {
      logger.warn({ dim: embedding?.length }, 'openai: unexpected embedding dim');
      return null;
    }

    return {
      embedding,
      model: OPENAI_EMBED_MODEL,
      tokens: data.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    logger.error({ err }, 'openai embed failed');
    return null;
  }
}

export async function embedQuery(query: string, ctx?: EmbedCtx): Promise<number[] | null> {
  const apiKey = await resolveOpenAIKey(ctx);
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input: query.slice(0, 8000),
        dimensions: OPENAI_EMBED_DIM,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * PostgreSQL vector(N) literal'i: [0.1,0.2,...]
 */
export function toPgVector(arr: number[]): string {
  return '[' + arr.map((v) => v.toFixed(6)).join(',') + ']';
}
