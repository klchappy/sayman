/**
 * In-memory sliding window rate limiter.
 *
 * Process restart edilirse counters sıfırlanır (kabul edilebilir).
 * Üretimde Upstash Redis'e taşınır (BullMQ entegre olabilir).
 *
 * Kullanım:
 *   consumeRateLimit({ identifier: `signin:${email}`, limit: 5, window_seconds: 60 });
 *   // Aşılırsa HttpError(429) fırlatır
 */
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

export function consumeRateLimit({ identifier, limit, window_seconds = 60 }: RateLimitInput): void {
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
 * Periyodik temizlik (memory leak engelle) — runtime'da setInterval ile çağrılır
 * (apps/api/src/index.ts'de).
 */
export function cleanupExpiredSlots(): void {
  const now = Date.now();
  for (const [key, slot] of _slots) {
    if (slot.resetAt < now) _slots.delete(key);
  }
}
