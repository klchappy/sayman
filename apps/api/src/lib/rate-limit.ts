/**
 * Rate limiter — Upstash Redis varsa cluster-safe sliding window,
 * yoksa in-memory fallback (process-local).
 *
 * Production: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set edildiğinde
 * tüm replica'lar aynı sayacı paylaşır.
 *
 * Kullanım:
 *   await consumeRateLimit({ identifier: `signin:${email}`, limit: 5, window_seconds: 60 });
 *   // Aşılırsa HttpError(429) fırlatır
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from './helpers';

interface Slot {
  count: number;
  resetAt: number;
}

const _slots = new Map<string, Slot>();

interface RateLimitInput {
  identifier: string;
  limit: number;
  window_seconds?: number;
}

// Upstash istemcisi (modül-level singleton)
let _redis: Redis | null = null;
const _ratelimiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (!isConfigured.upstashRedis) return null;
  if (_redis) return _redis;
  try {
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
    logger.info('Upstash Redis rate limiter aktif');
    return _redis;
  } catch (err) {
    logger.warn({ err }, 'Upstash Redis bağlanamadı, in-memory fallback kullanılıyor');
    return null;
  }
}

function getRatelimiter(limit: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${limit}:${windowSec}`;
  let rl = _ratelimiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: false,
      prefix: 'sayman:rl',
    });
    _ratelimiters.set(key, rl);
  }
  return rl;
}

export async function consumeRateLimit({
  identifier,
  limit,
  window_seconds = 60,
}: RateLimitInput): Promise<void> {
  const rl = getRatelimiter(limit, window_seconds);
  if (rl) {
    try {
      const { success, reset } = await rl.limit(identifier);
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        throw new HttpError(
          429,
          `Çok fazla istek (${limit}/${window_seconds}s). ${retryAfter}s sonra tekrar dene.`,
          'RATE_LIMITED',
        );
      }
      return;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Redis hatasında fallback'e düş
      logger.warn({ err }, 'Upstash rate limit hatası, in-memory fallback');
    }
  }

  // In-memory fallback
  const now = Date.now();
  const windowMs = window_seconds * 1000;
  let slot = _slots.get(identifier);

  if (!slot || slot.resetAt < now) {
    slot = { count: 0, resetAt: now + windowMs };
    _slots.set(identifier, slot);
  }

  slot.count++;

  if (slot.count > limit) {
    const retryAfter = Math.ceil((slot.resetAt - now) / 1000);
    throw new HttpError(
      429,
      `Çok fazla istek (${limit}/${window_seconds}s). ${retryAfter}s sonra tekrar dene.`,
      'RATE_LIMITED',
    );
  }
}

/**
 * Periyodik temizlik (memory leak engelle) — runtime'da setInterval ile çağrılır.
 * Sadece in-memory map için anlamlı; Upstash kendi TTL'iyle temizlenir.
 */
export function cleanupExpiredSlots(): void {
  const now = Date.now();
  for (const [key, slot] of _slots) {
    if (slot.resetAt < now) _slots.delete(key);
  }
}
