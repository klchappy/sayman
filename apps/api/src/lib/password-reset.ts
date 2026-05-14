/**
 * Password reset — süreli (2 saat) + tek kullanımlık + e-mail/SMS dispatcher.
 *
 * Güvenlik kuralları:
 *   - Plain token sadece caller'a (e-mail/SMS gönderimi için) döner;
 *     DB'de SHA-256 hash saklanır.
 *   - Enumeration koruması: account yoksa bile aynı API response yapısı dönmeli
 *     (caller seviyesi).
 *   - SMS/WhatsApp ile YENİ ŞİFRE GÖNDERME — sadece reset linki gönder
 *     (Damga pattern'i = güvenlik açığı).
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  authAccounts,
  getDb,
  passwordResetTokens,
  type AuthAccount,
} from '@sayman/db';
import { env } from '../config/env';
import { logger } from '../config/logger';

const TOKEN_TTL_HOURS = 2;
const BCRYPT_COST = env.NODE_ENV === 'production' ? 12 : 10;

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

interface CreateTokenResult {
  token: string; // plain — caller'a döner
  expires_at: Date;
}

export async function createResetToken(
  accountId: string,
  ip?: string | null,
  ua?: string | null,
): Promise<CreateTokenResult> {
  const plain = crypto.randomBytes(32).toString('base64url');
  const hash = sha256Hex(plain);
  const expires_at = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await getDb().insert(passwordResetTokens).values({
    account_id: accountId,
    token_hash: hash,
    expires_at,
    ip_address: ip ?? null,
    user_agent: ua ?? null,
  });

  return { token: plain, expires_at };
}

interface VerifyResult {
  ok: boolean;
  account_id?: string;
  email?: string;
  reason?: 'expired' | 'used' | 'not_found';
}

export async function verifyResetToken(token: string): Promise<VerifyResult> {
  const hash = sha256Hex(token);
  const db = getDb();

  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      account_id: passwordResetTokens.account_id,
      expires_at: passwordResetTokens.expires_at,
      consumed_at: passwordResetTokens.consumed_at,
      email: authAccounts.email,
    })
    .from(passwordResetTokens)
    .leftJoin(authAccounts, eq(authAccounts.id, passwordResetTokens.account_id))
    .where(eq(passwordResetTokens.token_hash, hash));

  if (!row) return { ok: false, reason: 'not_found' };
  if (row.consumed_at) return { ok: false, reason: 'used' };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true, account_id: row.account_id, email: row.email ?? undefined };
}

interface ConsumeInput {
  token: string;
  new_password: string;
}

export async function consumeResetToken(input: ConsumeInput): Promise<VerifyResult> {
  const v = await verifyResetToken(input.token);
  if (!v.ok || !v.account_id) return v;

  const hash = sha256Hex(input.token);
  const password_hash = await bcrypt.hash(input.new_password, BCRYPT_COST);
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ consumed_at: new Date() })
      .where(and(eq(passwordResetTokens.token_hash, hash), isNull(passwordResetTokens.consumed_at)));

    await tx
      .update(authAccounts)
      .set({ password_hash, updated_at: new Date() })
      .where(eq(authAccounts.id, v.account_id!));
  });

  return v;
}

// --- Dispatcher (E-posta / SMS / WhatsApp) ----------------------------------

interface DispatchEmailInput {
  account: AuthAccount;
  ip?: string | null;
  user_agent?: string | null;
}

interface DispatchEmailResult {
  delivered: 'sent' | 'link_generated';
  action_link: string; // her durumda döner; gateway yoksa caller bu link'i göstersin
}

export async function dispatchForgotEmail(input: DispatchEmailInput): Promise<DispatchEmailResult> {
  const { token, expires_at } = await createResetToken(input.account.id, input.ip, input.user_agent);
  const webUrl = env.PUBLIC_WEB_URL ?? env.CLIENT_URL;
  const action_link = `${webUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  // Resend gateway varsa mail at; yoksa fallback
  const { sendPasswordResetEmail } = await import('./email');
  const result = await sendPasswordResetEmail({
    to: input.account.email,
    resetUrl: action_link,
    expiresAt: expires_at,
  });

  logger.info(
    { email: input.account.email, delivered: result.delivered },
    'Password reset email dispatched',
  );
  return {
    delivered: result.delivered === 'email' ? 'sent' : 'link_generated',
    action_link,
  };
}

interface DispatchPhoneInput {
  account: AuthAccount;
  method: 'sms' | 'whatsapp';
}

interface DispatchPhoneResult {
  delivered: 'sent' | 'fallback';
  fallback_url?: string;
  error?: string;
}

export async function dispatchForgotPhone(input: DispatchPhoneInput): Promise<DispatchPhoneResult> {
  const { token } = await createResetToken(input.account.id);
  const webUrl = env.PUBLIC_WEB_URL ?? env.CLIENT_URL;
  const action_link = `${webUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  // ASLA plain-text yeni şifre üretme. Damga pattern'i (SMS ile yeni şifre) güvenlik açığı.
  // Sadece reset linki gönder. Gateway entegrasyonu (Twilio/Netgsm) Faz 4+'da.
  logger.info(
    { email: input.account.email, method: input.method },
    'Password reset phone dispatch (fallback mode)',
  );
  return { delivered: 'fallback', fallback_url: action_link };
}
