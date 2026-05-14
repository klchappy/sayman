/**
 * Telegram Bot API wrapper — graceful fallback.
 *
 * Env yoksa (TELEGRAM_BOT_TOKEN): no-op, log + return { delivered: 'no_gateway' }
 * Env varsa: Bot API'a POST + return { delivered: 'sent', message_id }
 *
 * Kullanıcının kendi chat_id'sini almak için akış (UI):
 *   1. Kullanıcı /security sayfasında "Telegram'ı bağla" tıklar
 *   2. UI bot adını + bir start link gösterir: t.me/<botname>?start=<userid>
 *   3. Kullanıcı bot'a /start atar → bot webhook'unda chat_id eşleşir → DB'ye yazılır
 *
 * Faz N MVP: webhook YOK, kullanıcı manuel chat_id girer (test için).
 * @<botname> üzerinden test:
 *   1. https://api.telegram.org/bot<TOKEN>/getMe → bot bilgileri
 *   2. Kullanıcı bot'a /start atar
 *   3. https://api.telegram.org/bot<TOKEN>/getUpdates → chat_id görünür
 *   4. Kullanıcı bu chat_id'yi UI'da kendine kaydeder
 */
import { env } from '../config/env';
import { logger } from '../config/logger';

export const isTelegramConfigured = Boolean(env.TELEGRAM_BOT_TOKEN);

export interface SendTelegramParams {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  disableNotification?: boolean;
}

export interface SendTelegramResult {
  delivered: 'sent' | 'no_gateway' | 'failed';
  message_id?: number;
  error?: string;
}

export async function sendTelegramMessage(params: SendTelegramParams): Promise<SendTelegramResult> {
  if (!isTelegramConfigured) {
    logger.debug({ chatId: params.chatId }, 'Telegram not configured — skipping');
    return { delivered: 'no_gateway' };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN!}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.text,
          parse_mode: params.parseMode ?? 'Markdown',
          disable_notification: params.disableNotification ?? false,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      logger.error(
        { status: res.status, body: errText, chatId: params.chatId },
        'Telegram send failed',
      );
      return { delivered: 'failed', error: errText };
    }

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    if (!data.ok || !data.result) {
      return { delivered: 'failed', error: 'API returned ok=false' };
    }

    return { delivered: 'sent', message_id: data.result.message_id };
  } catch (err) {
    logger.error({ err, chatId: params.chatId }, 'Telegram network error');
    return { delivered: 'failed', error: (err as Error).message };
  }
}

/**
 * Bot bilgilerini al (UI'da bot adını göstermek için).
 */
export async function getTelegramBotInfo(): Promise<{ username?: string; first_name?: string } | null> {
  if (!isTelegramConfigured) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN!}/getMe`);
    if (!res.ok) return null;
    const data = (await res.json()) as { ok: boolean; result?: { username?: string; first_name?: string } };
    return data.result ?? null;
  } catch {
    return null;
  }
}

/**
 * Generic notification → Telegram MD message dönüştür.
 * Brand stilinde: başlık + body + action link.
 */
export function buildNotificationMessage(p: {
  title: string;
  body: string;
  actionUrl?: string;
}): string {
  let msg = `*${escapeMD(p.title)}*\n\n${escapeMD(p.body)}`;
  if (p.actionUrl) {
    msg += `\n\n[Görüntüle →](${p.actionUrl})`;
  }
  msg += `\n\n_Sayman — Muhasebe Operasyon_`;
  return msg;
}

function escapeMD(s: string): string {
  // Telegram Markdown V1 — sadece * _ [ ] ` escape
  return s.replace(/([*_`\[\]])/g, '\\$1');
}
