/**
 * /v1/webhooks — outbound webhook endpoint yönetimi.
 *
 *   GET    /v1/webhooks                → org'un endpoint listesi
 *   POST   /v1/webhooks                → yeni endpoint (secret bir kez döner)
 *   PATCH  /v1/webhooks/:id            → güncelle
 *   DELETE /v1/webhooks/:id            → sil
 *   GET    /v1/webhooks/:id/deliveries → son 50 delivery (debug)
 *   POST   /v1/webhooks/:id/test       → test event gönder
 */
import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, webhookDeliveries, webhookEndpoints } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const WEBHOOK_EVENTS = [
  'payable.created',
  'payable.updated',
  'payable.paid',
  'guarantee.created',
  'guarantee.expiring',
  'subscription.commitment_ending',
  'subsidiary.created',
  'tenant.created',
] as const;

const createSchema = z.object({
  name: z.string().min(2).max(120),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});
const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  is_active: z.boolean().optional(),
});

function genSecret(): string {
  return 'whsec_' + crypto.randomBytes(24).toString('base64url');
}

export const webhooksRouter = Router();

webhooksRouter.get('/webhooks', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: webhookEndpoints.id,
        name: webhookEndpoints.name,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        is_active: webhookEndpoints.is_active,
        last_status: webhookEndpoints.last_status,
        last_called_at: webhookEndpoints.last_called_at,
        last_error: webhookEndpoints.last_error,
        created_at: webhookEndpoints.created_at,
        // secret döndürme
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organization_id, req.activeOrgId!))
      .orderBy(desc(webhookEndpoints.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.post('/webhooks', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
    }
    const body = createSchema.parse(req.body);
    const db = getDb();
    const secret = genSecret();

    const [row] = await db
      .insert(webhookEndpoints)
      .values({
        organization_id: req.activeOrgId!,
        name: body.name,
        url: body.url,
        events: body.events,
        secret,
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'webhook.create',
      target_type: 'webhook_endpoints',
      target_id: row?.id,
      details: { url: body.url, events: body.events },
    });

    res.status(201).json({ data: row, secret });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.patch('/webhooks/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
    }
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .update(webhookEndpoints)
      .set({ ...body, updated_at: new Date() })
      .where(
        and(
          eq(webhookEndpoints.id, String(req.params.id ?? '')),
          eq(webhookEndpoints.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Webhook bulunamadı', 'NOT_FOUND');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.delete('/webhooks/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
    }
    const db = getDb();
    const [row] = await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, String(req.params.id ?? '')),
          eq(webhookEndpoints.organization_id, req.activeOrgId!),
        ),
      )
      .returning({ id: webhookEndpoints.id });
    if (!row) throw new HttpError(404, 'Webhook bulunamadı', 'NOT_FOUND');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.get('/webhooks/:id/deliveries', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const [ep] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, String(req.params.id ?? '')),
          eq(webhookEndpoints.organization_id, req.activeOrgId!),
        ),
      );
    if (!ep) throw new HttpError(404, 'Webhook bulunamadı', 'NOT_FOUND');

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpoint_id, ep.id))
      .orderBy(desc(webhookDeliveries.created_at))
      .limit(50);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

webhooksRouter.post('/webhooks/:id/test', requireAuth, requireOrg, async (req, res, next) => {
  try {
    if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
      throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
    }
    const db = getDb();
    const [ep] = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, String(req.params.id ?? '')),
          eq(webhookEndpoints.organization_id, req.activeOrgId!),
        ),
      );
    if (!ep) throw new HttpError(404, 'Webhook bulunamadı', 'NOT_FOUND');

    await db.insert(webhookDeliveries).values({
      endpoint_id: ep.id,
      event: 'payable.created',
      payload: {
        test: true,
        message: 'Sayman test webhook delivery',
        timestamp: new Date().toISOString(),
      },
      status: 'pending',
      next_retry_at: new Date(),
    });
    res.json({ ok: true, message: 'Test delivery kuyruğa alındı (1 dk içinde gönderilir)' });
  } catch (err) {
    next(err);
  }
});
