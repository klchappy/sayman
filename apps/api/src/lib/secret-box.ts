/**
 * AES-256-GCM secret encryption.
 *
 * Key derivation: SHA-256(ENCRYPTION_SECRET ?? JWT_SECRET).
 * Format: "v1:iv_b64url:tag_b64url:ciphertext_b64url"
 *
 * Kullanım:
 *   encryptSecret('hassas') → "v1:abc:def:ghi"
 *   decryptSecret(blob)     → 'hassas'
 *   secretHint('abc...xyz') → 'abc1...xyz9'
 */
import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;
const VERSION = 'v1';

let _key: Buffer | null = null;
function getKey(): Buffer {
  if (_key) return _key;
  const secret = env.ENCRYPTION_SECRET ?? env.JWT_SECRET;
  _key = crypto.createHash('sha256').update(secret).digest();
  return _key;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${b64url(iv)}:${b64url(tag)}:${b64url(ciphertext)}`;
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`Geçersiz secret blob format: ${parts[0] ?? '?'}`);
  }
  const iv = b64urlDecode(parts[1]!);
  const tag = b64urlDecode(parts[2]!);
  const ciphertext = b64urlDecode(parts[3]!);
  if (tag.length !== TAG_LENGTH) throw new Error('Geçersiz GCM auth tag');

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/**
 * "abc1...xyz9" formatında display hint — orijinal secret'ı asla göstermez,
 * sadece kullanıcının doğrulayabileceği ilk 4 + son 4 karakter.
 */
export function secretHint(plain: string): string {
  if (plain.length <= 8) return '****';
  return `${plain.slice(0, 4)}...${plain.slice(-4)}`;
}
