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
import { Router } from 'express';
import { z } from 'zod';
import { env, isConfigured } from '../config/env';
import { logger } from '../config/logger';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { parseWhatsAppInbound, sendWhatsAppMessage } from '../lib/whatsapp';
import { requireAuth } from '../middleware/auth';

export const whatsappRouter = Router();

whatsappRouter.get('/whatsapp/status', requireAuth, requireOrg, async (_req, res) => {
  res.json({
    data: {
      configured: isConfigured.whatsapp,
      has_verify_token: Boolean(env.WHATSAPP_VERIFY_TOKEN),
      phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    },
  });
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

// Meta POST inbound — log only (MVP)
whatsappRouter.post('/whatsapp/inbound', async (req, res) => {
  try {
    const messages = parseWhatsAppInbound(req.body);
    for (const m of messages) {
      logger.info(
        { from: m.from, text: m.text.slice(0, 100), ts: m.timestamp },
        'whatsapp inbound message',
      );
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
