/**
 * RFC 6238 TOTP — otplib KULLANMA, custom implementation.
 *
 * Niye custom: otplib v13 API'si bozuk (Crypto plugin, period/step ismi
 * karmaşık, ESM/CJS sürtüşmesi). 50 satır node:crypto ile temiz iş.
 *
 * Specs:
 *   - HMAC-SHA1 (Google Authenticator default)
 *   - 30s period, 6 digit
 *   - ±1 step drift tolerance
 *   - Base32 secret (20 bytes / 32 char)
 */
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../config/env';

const ISSUER = 'Sayman';
const PERIOD = 30;
const DIGITS = 6;
const ALGORITHM = 'sha1';
const SECRET_BYTES = 20;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Random 20-byte secret → base32 string (32 char). */
export function generateTotpSecret(): string {
  const buf = crypto.randomBytes(SECRET_BYTES);
  return base32Encode(buf);
}

/** otpauth:// URL for QR code (Google Authenticator format). */
export function buildOtpAuthUrl(email: string, secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
}

/**
 * TOTP code'u doğrula, ±1 step tolerans + timing-safe compare.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, '').padStart(DIGITS, '0');
  if (cleaned.length !== DIGITS || !/^\d+$/.test(cleaned)) return false;

  const secretBuf = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / PERIOD);

  for (const offset of [-1, 0, 1]) {
    const candidate = computeTotp(secretBuf, step + offset);
    if (timingSafeStringEqual(candidate, cleaned)) return true;
  }
  return false;
}

/** RFC 6238 step'ten 6-haneli code üret. */
function computeTotp(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  // 64-bit big-endian counter
  counter.writeBigUInt64BE(BigInt(step), 0);

  const hmac = crypto.createHmac(ALGORITHM, secret).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binCode =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  const code = binCode % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// --- Recovery codes ---------------------------------------------------------

/**
 * 10 adet "XXXXX-XXXXX" formatında recovery code üret.
 * Plain'i kullanıcıya bir kez göster, DB'ye SHA-256+pepper hash'i saklanır.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = randomAlphanumeric(5);
    const part2 = randomAlphanumeric(5);
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

function randomAlphanumeric(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // I, O, 0, 1 hariç (confuse)
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[crypto.randomInt(0, chars.length)];
  }
  return s;
}

/**
 * Recovery code hash — SHA-256(pepper + code). Pepper JWT_SECRET'ten alınır.
 * DB'de plain saklama yok; sadece hash'ler array içinde.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  return crypto
    .createHash('sha256')
    .update(env.JWT_SECRET)
    .update(normalized)
    .digest('hex');
}

// --- Base32 (RFC 4648) ------------------------------------------------------

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Geçersiz base32 karakter: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
