/**
 * Embeddings wrapper — Voyage AI (Anthropic's recommended embedding provider).
 *
 * Env yoksa (VOYAGE_API_KEY): no-op, kullanıcı dostu hata
 * Env varsa: voyage-3-lite (1024 boyut) ile metin → vektör
 *
 * Voyage AI:
 *   - https://docs.voyageai.com
 *   - Sign up: https://dash.voyageai.com
 *   - voyage-3-lite: 1024d, multilingual (Türkçe destekli), 200 RPM free tier
 *
 * Maliyet: $0.02 / 1M token (voyage-3-lite). 10000 fatura ≈ $0.001.
 */
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';

const VOYAGE_MODEL = 'voyage-3-lite';
const VOYAGE_DIM = 1024;

export interface EmbedResult {
  embedding: number[];
  model: string;
  tokens: number;
}

export async function embedText(text: string): Promise<EmbedResult | null> {
  if (!isConfigured.embeddings) {
    logger.debug('embed: VOYAGE_API_KEY not set, skipping');
    return null;
  }

  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: text.slice(0, 8000),
        input_type: 'document',
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      logger.warn({ status: res.status, errTxt: errTxt.slice(0, 200) }, 'voyage embed error');
      return null;
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens?: number };
    };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== VOYAGE_DIM) {
      logger.warn({ dim: embedding?.length }, 'voyage: unexpected dim');
      return null;
    }
    return {
      embedding,
      model: VOYAGE_MODEL,
      tokens: data.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    logger.error({ err }, 'voyage embed failed');
    return null;
  }
}

export async function embedQuery(query: string): Promise<number[] | null> {
  if (!isConfigured.embeddings) return null;
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: query.slice(0, 8000),
        input_type: 'query',
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
