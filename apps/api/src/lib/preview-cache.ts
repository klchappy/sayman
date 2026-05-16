/**
 * Smart Import preview cache.
 *
 * Sorun: Smart Import iki adımlı (preview + commit). Frontend dosyayı iki kez yüklüyordu:
 *   1. POST /smart-import (preview) — parse + tip tespit
 *   2. POST /smart-import?commit=true — aynı dosya tekrar, gerçek insert
 *
 * 30 MB ZIP için bu network'te 60 MB, sunucuda iki kez parse demek.
 *
 * Çözüm: Preview'de dosyanın SHA256 hash'iyle parse edilmiş veriyi in-memory
 * LRU cache'e koyuyoruz. Commit isteği `cache_key` ile gelirse re-parse yapmıyoruz.
 *
 * - TTL: 5 dakika (idle expire)
 * - Max entry: 100 (LRU)
 * - Tenant/user-scoped key — başka kullanıcı senin parse'ını commit edemesin
 *
 * Production'da Redis'e taşınabilir, ama tek-process Express için Map yeterli.
 */
import crypto from 'node:crypto';

const TTL_MS = 5 * 60 * 1000; // 5 dakika
const MAX_ENTRIES = 100;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  ownerKey: string; // tenant+user — başkası bu cache'i kullanamasın
}

const store = new Map<string, CacheEntry<unknown>>();

function evictExpired(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}

function evictOldest(): void {
  if (store.size < MAX_ENTRIES) return;
  // Map iteration order == insertion order, en eski = ilk
  const oldestKey = store.keys().next().value;
  if (oldestKey) store.delete(oldestKey);
}

/** Dosya buffer'ından SHA256 hash hesapla. */
export function hashBuffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Preview parse sonucunu cache'e koy. Anahtar = `<hash>:<tenantId>` */
export function cachePreview<T>(hash: string, tenantId: string, userId: string, value: T): void {
  evictExpired();
  evictOldest();
  const ownerKey = `${tenantId}:${userId}`;
  store.set(hash, {
    value,
    expiresAt: Date.now() + TTL_MS,
    ownerKey,
  });
}

/** Cache'den getir. Sahibi eşleşmezse veya TTL geçtiyse null. */
export function getCachedPreview<T>(hash: string, tenantId: string, userId: string): T | null {
  const entry = store.get(hash);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(hash);
    return null;
  }
  if (entry.ownerKey !== `${tenantId}:${userId}`) return null;
  return entry.value as T;
}

/** Commit sonrası temizle. */
export function invalidatePreview(hash: string): void {
  store.delete(hash);
}

/** Test/debug için */
export function _cacheSize(): number {
  return store.size;
}
