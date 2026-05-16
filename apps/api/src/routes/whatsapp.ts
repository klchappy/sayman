/**
 * /v1/whatsapp — WhatsApp Business Cloud API rotaları.
 *
 *   GET  /v1/whatsapp/inbound       → Meta verify URL (hub.mode + hub.verify_token + hub.challenge)
 *   POST /v1/whatsapp/inbound       → Meta'dan gelen mesaj/status webhook'u
 *   POST /v1/whatsapp/test (admin)  → Test mesajı gönder (auth required)
 *   GET  /v1/whatsapp/status        → Yapılandırma durumu
 *
 * Meta setup:
 *   1. business.facebook.com → WhatsApp Cloud API → Configuration
 *   2. Callback URL: https://api.sayman.deploi.net/v1/whatsapp/inbound
 *   3. Verify token: WHATSAPP_VERIFY_TOKEN env değeri ile aynı
 *   4. Subscribe: messages, message_status
 */
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '@sayman/db';
import { env, isConfigured, isProd } from '../config/env';
import { logger } from '../config/logger';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { parseWhatsAppInbound, sendWhatsAppMessage } from '../lib/whatsapp';
import { requireAuth } from '../middleware/auth';

export const whatsappRouter = Router();

/**
 * Meta WhatsApp imza doğrulaması — x-hub-signature-256 header'ı.
 * Production'da WHATSAPP_APP_SECRET zorunlu; geliştirme ortamında secret
 * yapılandırılmadıysa atlanır (uyarı log'u ile).
 */
function verifyWhatsappSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
): { ok: boolean; reason?: string } {
  if (!env.WHATSAPP_APP_SECRET) {
    if (isProd) return { ok: false, reason: 'app_secret_not_configured' };
    logger.warn('WHATSAPP_APP_SECRET yok — dev modda imza dogrulama atlandi');
    return { ok: true };
  }
  if (!rawBody) return { ok: false, reason: 'no_raw_body' };
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, reason: 'missing_header' };
  }
  const provided = signatureHeader.slice(7);
  const expected = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return { ok: false, reason: 'length_mismatch' };
    if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'sig_mismatch' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'compare_failed' };
  }
}

whatsappRouter.get('/whatsapp/status', requireAuth, requireOrg, async (_req, res, next) => {
  try {
    res.json({
      data: {
        configured: isConfigured.whatsapp,
        has_verify_token: Boolean(env.WHATSAPP_VERIFY_TOKEN),
        has_app_secret: Boolean(env.WHATSAPP_APP_SECRET),
        phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Meta GET verify (hub.mode=subscribe + hub.verify_token + hub.challenge)
whatsappRouter.get('/whatsapp/inbound', (req, res) => {
  const mode = String(req.query['hub.mode'] ?? '');
  const token = String(req.query['hub.verify_token'] ?? '');
  const challenge = String(req.query['hub.challenge'] ?? '');
  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN && env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send('forbidden');
});

// Meta POST inbound — signature verified
whatsappRouter.post('/whatsapp/inbound', async (req, res) => {
  // İmza doğrula — saldırgan sahte mesaj POST'layamasın
  const sig = req.headers['x-hub-signature-256'];
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  const verify = verifyWhatsappSignature(rawBody, typeof sig === 'string' ? sig : undefined);
  if (!verify.ok) {
    logger.warn({ reason: verify.reason }, 'whatsapp inbound rejected — invalid signature');
    res.status(403).send('forbidden');
    return;
  }
  try {
    const messages = parseWhatsAppInbound(req.body);
    const db = getDb();

    for (const m of messages) {
      logger.info(
        { from: m.from, text: m.text.slice(0, 100), ts: m.timestamp },
        'whatsapp inbound message',
      );

      // Notification yarat — WhatsApp configured tüm org'ların admin/yönetici
      // kullanıcılarına. Dedupe: aynı message_id 2. defa gelirse insert yok.
      try {
        const orgsWithWa = await db.execute(sql`
          SELECT DISTINCT organization_id
          FROM integration_credentials
          WHERE integration_key = 'whatsapp' AND is_active = true
        `);
        const orgs = ((orgsWithWa.rows ?? orgsWithWa) as Array<{ organization_id: string }>).map(
          (r) => r.organization_id,
        );

        if (orgs.length === 0) {
          // env'de yapılandırılmış da olabilir → tüm org adminlerine fan-out
          // (tek prod tenant senaryosunda makul)
          const allOrgs = await db.execute(sql`SELECT id FROM organizations LIMIT 100`);
          orgs.push(
            ...((allOrgs.rows ?? allOrgs) as Array<{ id: string }>).map((r) => r.id),
          );
        }

        for (const orgId of orgs) {
          const admins = await db.execute(sql`
            SELECT user_id FROM user_organization_roles
            WHERE organization_id = ${orgId}::uuid
              AND role IN ('super_admin', 'organization_admin', 'yonetici')
          `);
          const adminIds = ((admins.rows ?? admins) as Array<{ user_id: string }>).map(
            (r) => r.user_id,
          );

          for (const userId of adminIds) {
            const dedupeKey = `whatsapp_inbound:${m.message_id}:${userId}`;
            await db
              .execute(sql`
                INSERT INTO notifications
                  (user_id, tenant_id, title, body, category, priority, related_table, related_id, action_url, dedupe_key, metadata)
                VALUES (
                  ${userId}::uuid, NULL,
                  ${'WhatsApp: ' + m.from},
                  ${m.text.slice(0, 500)},
                  'system'::notification_category, 'info'::notification_priority,
                  'whatsapp_inbound', NULL, '/integrations',
                  ${dedupeKey}, ${JSON.stringify({ from: m.from, message_id: m.message_id, ts: m.timestamp })}::jsonb
                )
                ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
              `)
              .catch((err) => {
                logger.warn({ err, userId }, 'whatsapp notification insert failed');
              });
          }
        }
      } catch (err) {
        logger.warn({ err }, 'whatsapp inbound notification fan-out failed');
      }
    }
    res.status(200).json({ received: messages.length });
  } catch (err) {
    logger.error({ err }, 'whatsapp inbound handler crashed');
    res.status(200).send('ok'); // Meta retry sebebi yaratma
  }
});

const testSchema = z.object({
  to: z.string().min(10).max(20),
  text: z.string().min(1).max(1000),
});

whatsappRouter.post('/whatsapp/test', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
    }
    if (!isConfigured.whatsapp) {
      throw new HttpError(503, 'WhatsApp yapılandırılmamış', 'NO_WHATSAPP');
    }
    const { to, text } = testSchema.parse(req.body);
    const r = await sendWhatsAppMessage({ to, text });
    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'whatsapp.test',
      details: { to, delivered: r.delivered, message_id: r.message_id ?? null },
    });
    res.json({ data: r });
  } catch (err) {
    next(err);
  }
});
