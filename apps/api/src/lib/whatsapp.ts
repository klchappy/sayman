/**
 * WhatsApp Business Cloud API wrapper — graceful fallback.
 *
 * Env yoksa (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID): no-op
 * Env varsa: Meta Graph API'ye POST + return { delivered: 'sent', message_id }
 *
 * Senaryolar:
 *   1. Fatura hatırlatma: "Türk Telekom 350 TL faturanız 3 gün içinde dolacak"
 *   2. Anomali bildirimi: "⚠️ Beklenmedik yüksek tutar"
 *   3. Aksiyon: WhatsApp'tan "ödendi" cevabı ile webhook → status update
 *
 * Setup:
 *   1. business.facebook.com → Meta for Developers
 *   2. WhatsApp Business app oluştur, "Cloud API" seç
 *   3. Permanent access token + phone_number_id al
 *   4. .env'e ekle:
 *      WHATSAPP_ACCESS_TOKEN=EAAxxxxx
 *      WHATSAPP_PHONE_NUMBER_ID=12345
 *   5. (Production) Webhook URL'ini Meta'da set et: /v1/webhooks/whatsapp/inbound
 *
 * Template mesajlar Meta'da onaylatılmalı (24h dışında sadece template gönderilebilir).
 * Bu wrapper MVP olarak text + template mesaj destekler.
 */
import { env } from '../config/env';
import { logger } from '../config/logger';

export const isWhatsAppConfigured = Boolean(
  env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID,
);

export interface SendWhatsAppParams {
  /** E164 formatında: +905551234567 → "905551234567" */
  to: string;
  /** Düz text mesaj (24h pencere içinde) */
  text?: string;
  /** Template mesaj (24h dışı) */
  template?: {
    name: string;
    language_code?: string;
    components?: unknown[];
  };
}

export interface SendWhatsAppResult {
  delivered: 'sent' | 'no_gateway' | 'failed';
  message_id?: string;
  error?: string;
}

const META_API_VERSION = 'v22.0';

export async function sendWhatsAppMessage(
  params: SendWhatsAppParams,
): Promise<SendWhatsAppResult> {
  if (!isWhatsAppConfigured) {
    logger.debug({ to: params.to }, 'WhatsApp not configured — skipping');
    return { delivered: 'no_gateway' };
  }

  const cleanTo = params.to.replace(/[^\d]/g, '');
  if (!cleanTo || cleanTo.length < 10) {
    return { delivered: 'failed', error: 'invalid phone number' };
  }

  const body = params.template
    ? {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: params.template.name,
          language: { code: params.template.language_code ?? 'tr' },
          components: params.template.components ?? [],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'text',
        text: { body: params.text ?? '' },
      };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errTxt = await res.text();
      logger.warn({ status: res.status, errTxt }, 'WhatsApp API error');
      return { delivered: 'failed', error: errTxt.slice(0, 200) };
    }

    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    const message_id = data.messages?.[0]?.id;
    logger.info({ to: cleanTo, message_id }, 'WhatsApp message sent');
    return { delivered: 'sent', message_id };
  } catch (err) {
    logger.error({ err }, 'WhatsApp API call failed');
    return { delivered: 'failed', error: (err as Error).message };
  }
}

/**
 * Status webhook'larından gelen mesaj durumlarını parse eder.
 * Meta payload format: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */
export interface WhatsAppInboundMessage {
  from: string;
  message_id: string;
  text: string;
  timestamp: number;
}

export function parseWhatsAppInbound(payload: unknown): WhatsAppInboundMessage[] {
  try {
    const p = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from: string;
              id: string;
              timestamp: string;
              text?: { body: string };
            }>;
          };
        }>;
      }>;
    };
    const out: WhatsAppInboundMessage[] = [];
    for (const e of p.entry ?? []) {
      for (const c of e.changes ?? []) {
        for (const m of c.value?.messages ?? []) {
          out.push({
            from: m.from,
            message_id: m.id,
            text: m.text?.body ?? '',
            timestamp: Number(m.timestamp ?? 0),
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}
