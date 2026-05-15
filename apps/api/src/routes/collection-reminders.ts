/**
 * /v1/collection-reminder-rules — Geciken alacak için otomatik mesaj kuralları.
 *
 *   GET   /v1/collection-reminder-rules    → tenant kural listesi
 *   POST  /v1/collection-reminder-rules    → yeni kural
 *   PATCH /v1/collection-reminder-rules/:id
 *   DELETE
 *   GET   /v1/collection-reminder-runs?invoice_id=... → gönderim history
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import {
  collectionReminderRules,
  collectionReminderRuns,
  getDb,
} from '@sayman/db';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const collectionRemindersRouter = Router();

collectionRemindersRouter.get(
  '/collection-reminder-rules',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(collectionReminderRules)
        .where(eq(collectionReminderRules.tenant_id, req.activeTenantId!))
        .orderBy(collectionReminderRules.days_after_due);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

const ruleSchema = z.object({
  name: z.string().min(2).max(120),
  days_after_due: z.number().int().min(0).max(365),
  channel: z.enum(['email', 'whatsapp', 'telegram']).default('email'),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(10).max(4000),
  min_amount: z.number().min(0).default(0).optional(),
  is_active: z.boolean().default(true).optional(),
});

collectionRemindersRouter.post(
  '/collection-reminder-rules',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = ruleSchema.parse(req.body);
      const db = getDb();
      const [row] = await db
        .insert(collectionReminderRules)
        .values({
          tenant_id: req.activeTenantId!,
          name: body.name,
          days_after_due: String(body.days_after_due),
          channel: body.channel,
          subject: body.subject ?? null,
          body: body.body,
          min_amount: String(body.min_amount ?? 0),
          is_active: body.is_active ?? true,
        })
        .returning();
      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

const patchSchema = ruleSchema.partial();

collectionRemindersRouter.patch(
  '/collection-reminder-rules/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const body = patchSchema.parse(req.body);
      const db = getDb();
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (body.name) patch.name = body.name;
      if (body.days_after_due != null) patch.days_after_due = String(body.days_after_due);
      if (body.channel) patch.channel = body.channel;
      if (body.subject !== undefined) patch.subject = body.subject;
      if (body.body) patch.body = body.body;
      if (body.min_amount != null) patch.min_amount = String(body.min_amount);
      if (body.is_active != null) patch.is_active = body.is_active;

      const [row] = await db
        .update(collectionReminderRules)
        .set(patch)
        .where(
          and(
            eq(collectionReminderRules.id, String(req.params.id ?? '')),
            eq(collectionReminderRules.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Kural bulunamadı');
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

collectionRemindersRouter.delete(
  '/collection-reminder-rules/:id',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .delete(collectionReminderRules)
        .where(
          and(
            eq(collectionReminderRules.id, String(req.params.id ?? '')),
            eq(collectionReminderRules.tenant_id, req.activeTenantId!),
          ),
        )
        .returning({ id: collectionReminderRules.id });
      if (!row) throw new HttpError(404, 'Kural bulunamadı');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

collectionRemindersRouter.get(
  '/collection-reminder-runs',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const conditions: any[] = [eq(collectionReminderRuns.tenant_id, req.activeTenantId!)];
      if (req.query.invoice_id) {
        conditions.push(
          eq(collectionReminderRuns.sales_invoice_id, String(req.query.invoice_id)),
        );
      }
      const rows = await db
        .select()
        .from(collectionReminderRuns)
        .where(and(...conditions))
        .orderBy(desc(collectionReminderRuns.sent_at))
        .limit(200);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);
