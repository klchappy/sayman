/**
 * Inbound webhooks — Damga/n8n/Zapier'den Sayman'a gelen POST.
 *
 *   PUBLIC:
 *     POST /v1/inbound/:slug   → HMAC-SHA256 imza header'da, body event'e işlenir
 *
 *   ADMIN (auth):
 *     GET    /v1/inbound-endpoints           → liste
 *     POST   /v1/inbound-endpoints           → yeni (secret bir kez döner)
 *     DELETE /v1/inbound-endpoints/:id
 *     GET    /v1/inbound-endpoints/:id/events → son 50 event log
 *
 * Event tipleri:
 *   payable_create — body: { title, amount, supplier_name?, invoice_number?, due_date?, ... }
 *   invoice_xml    — body: { xml: "<Invoice>..." } → /efatura/import gibi
 *   generic        — body: keyfi JSON, sadece log (manuel işlenir)
 */
import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  getDb,
  inboundWebhookEndpoints,
  inboundWebhookEvents,
  payableItems,
} from '@sayman/db';
import { suggestCategory } from '@sayman/shared';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { parseUblXml } from './efatura-helpers';

function genSecret(): string {
  return 'whsec_in_' + crypto.randomBytes(24).toString('base64url');
}

function genSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
}

export const inboundWebhooksRouter = Router();

// === PUBLIC: gelen webhook ===
inboundWebhooksRouter.post('/inbound/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? '');
    const db = getDb();
    const [ep] = await db
      .select()
      .from(inboundWebhookEndpoints)
      .where(and(eq(inboundWebhookEndpoints.slug, slug), eq(inboundWebhookEndpoints.is_active, true)));
    if (!ep) {
      res.status(404).json({ error: 'endpoint_not_found' });
      return;
    }

    // HMAC doğrula
    const rawBody = JSON.stringify(req.body ?? {});
    const sig = String(req.headers['x-sayman-inbound-signature'] ?? '').replace(/^sha256=/, '');
    const expected = crypto.createHmac('sha256', ep.secret).update(rawBody).digest('hex');
    if (sig !== expected) {
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    // Event kaydı (önce log, sonra process)
    const [evt] = await db
      .insert(inboundWebhookEvents)
      .values({ endpoint_id: ep.id, payload: req.body, status: 'received' })
      .returning();
    if (!evt) throw new HttpError(500, 'event log failed');

    // İşleme: event_type'a göre
    try {
      let createdRecordId: string | null = null;

      if (ep.event_type === 'payable_create') {
        if (!ep.tenant_id) throw new Error('endpoint has no tenant_id; cannot create payable');
        const body = z
          .object({
            title: z.string().min(2).max(255),
            amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
            supplier_name: z.string().optional().nullable(),
            invoice_number: z.string().optional().nullable(),
            due_date: z.string().optional().nullable(),
            issue_date: z.string().optional().nullable(),
            currency: z.string().length(3).optional(),
            notes: z.string().optional().nullable(),
          })
          .parse(req.body);

        const sug = suggestCategory(body.title, body.supplier_name, body.notes);
        const [row] = await db
          .insert(payableItems)
          .values({
            tenant_id: ep.tenant_id,
            owner_type: 'company',
            title: body.title,
            amount: body.amount,
            currency: body.currency ?? 'TRY',
            supplier_name: body.supplier_name ?? null,
            invoice_number: body.invoice_number ?? null,
            issue_date: body.issue_date ?? null,
            due_date: body.due_date ?? null,
            notes: body.notes ?? null,
            category: sug && sug.confidence >= 0.3 ? sug.category : null,
            status: 'pending',
            metadata: { source: 'inbound_webhook', endpoint: ep.slug },
          })
          .returning({ id: payableItems.id });
        createdRecordId = row?.id ?? null;
      } else if (ep.event_type === 'invoice_xml') {
        if (!ep.tenant_id) throw new Error('endpoint has no tenant_id');
        const xml = String((req.body as Record<string, unknown>).xml ?? '');
        if (!xml) throw new Error('xml field gerekli');
        const parsed = parseUblXml(xml);
        const [row] = await db
          .insert(payableItems)
          .values({
            tenant_id: ep.tenant_id,
            owner_type: 'company',
            title: `e-Fatura: ${parsed.supplier_name ?? parsed.invoice_number}`,
            category: 'e-fatura',
            invoice_number: parsed.invoice_number,
            supplier_name: parsed.supplier_name,
            issue_date: parsed.issue_date,
            due_date: parsed.due_date,
            amount: parsed.amount,
            currency: parsed.currency,
            status: 'pending',
            notes: parsed.notes,
            metadata: { source: 'inbound_webhook_xml', endpoint: ep.slug },
          })
          .returning({ id: payableItems.id });
        createdRecordId = row?.id ?? null;
      }
      // generic: sadece log

      // Event ve endpoint stats güncelle
      await db
        .update(inboundWebhookEvents)
        .set({
          status: 'processed',
          created_record_id: createdRecordId,
          processed_at: new Date(),
        })
        .where(eq(inboundWebhookEvents.id, evt.id));

      await db
        .update(inboundWebhookEndpoints)
        .set({
          last_called_at: new Date(),
          call_count: ep.call_count + 1,
          updated_at: new Date(),
        })
        .where(eq(inboundWebhookEndpoints.id, ep.id));

      res.status(201).json({ ok: true, event_id: evt.id, record_id: createdRecordId });
    } catch (procErr) {
      await db
        .update(inboundWebhookEvents)
        .set({
          status: 'error',
          error_message: (procErr as Error).message,
          processed_at: new Date(),
        })
        .where(eq(inboundWebhookEvents.id, evt.id));
      throw procErr;
    }
  } catch (err) {
    next(err);
  }
});

// === ADMIN: yönetim ===

const createSchema = z.object({
  name: z.string().min(2).max(120),
  event_type: z.enum(['payable_create', 'invoice_xml', 'generic']).default('payable_create'),
  tenant_id: z.string().uuid().optional().nullable(),
});

inboundWebhooksRouter.get(
  '/inbound-endpoints',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: inboundWebhookEndpoints.id,
          name: inboundWebhookEndpoints.name,
          slug: inboundWebhookEndpoints.slug,
          event_type: inboundWebhookEndpoints.event_type,
          tenant_id: inboundWebhookEndpoints.tenant_id,
          is_active: inboundWebhookEndpoints.is_active,
          last_called_at: inboundWebhookEndpoints.last_called_at,
          call_count: inboundWebhookEndpoints.call_count,
          created_at: inboundWebhookEndpoints.created_at,
        })
        .from(inboundWebhookEndpoints)
        .where(eq(inboundWebhookEndpoints.organization_id, req.activeOrgId!))
        .orderBy(desc(inboundWebhookEndpoints.created_at));
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

inboundWebhooksRouter.post(
  '/inbound-endpoints',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const body = createSchema.parse(req.body);
      const db = getDb();
      const slug = genSlug(body.name);
      const secret = genSecret();
      const [row] = await db
        .insert(inboundWebhookEndpoints)
        .values({
          organization_id: req.activeOrgId!,
          tenant_id: body.tenant_id ?? null,
          name: body.name,
          slug,
          secret,
          event_type: body.event_type,
        })
        .returning();
      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'inbound_webhook.create',
        target_type: 'inbound_webhook_endpoints',
        target_id: row?.id,
        details: { slug, event_type: body.event_type },
      });
      res.status(201).json({
        data: { ...row, url: `/v1/inbound/${slug}` },
        secret,
      });
    } catch (err) {
      next(err);
    }
  },
);

inboundWebhooksRouter.delete(
  '/inbound-endpoints/:id',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!['super_admin', 'organization_admin'].includes(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }
      const db = getDb();
      const [row] = await db
        .delete(inboundWebhookEndpoints)
        .where(
          and(
            eq(inboundWebhookEndpoints.id, String(req.params.id ?? '')),
            eq(inboundWebhookEndpoints.organization_id, req.activeOrgId!),
          ),
        )
        .returning({ id: inboundWebhookEndpoints.id });
      if (!row) throw new HttpError(404, 'Endpoint bulunamadı');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

inboundWebhooksRouter.get(
  '/inbound-endpoints/:id/events',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [ep] = await db
        .select()
        .from(inboundWebhookEndpoints)
        .where(
          and(
            eq(inboundWebhookEndpoints.id, String(req.params.id ?? '')),
            eq(inboundWebhookEndpoints.organization_id, req.activeOrgId!),
          ),
        );
      if (!ep) throw new HttpError(404, 'Endpoint bulunamadı');

      const rows = await db
        .select()
        .from(inboundWebhookEvents)
        .where(eq(inboundWebhookEvents.endpoint_id, ep.id))
        .orderBy(desc(inboundWebhookEvents.received_at))
        .limit(50);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);
