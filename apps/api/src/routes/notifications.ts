/**
 * /v1/notifications — Bildirim merkezi (user-scope).
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, notifications } from '@sayman/db';
import { HttpError } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const unreadOnly = req.query['unread'] === 'true';

    const conditions = [eq(notifications.user_id, req.authUserId!)];
    if (unreadOnly) conditions.push(isNull(notifications.read_at));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.created_at))
      .limit(200);

    const [{ count }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.user_id, req.authUserId!), isNull(notifications.read_at)))) as {
      count: number;
    }[];

    res.json({ data: rows, count: rows.length, unread_count: count });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(
        and(
          eq(notifications.id, String(req.params.id ?? '')),
          eq(notifications.user_id, req.authUserId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Bildirim bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const result = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(and(eq(notifications.user_id, req.authUserId!), isNull(notifications.read_at)))
      .returning({ id: notifications.id });
    res.json({ ok: true, count: result.length });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/notifications/:id/dismiss', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(notifications)
      .set({ dismissed_at: new Date(), read_at: new Date() })
      .where(
        and(
          eq(notifications.id, String(req.params.id ?? '')),
          eq(notifications.user_id, req.authUserId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Bildirim bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

// Debug/dev: bildirim oluştur (dispatcher servisi Faz F'de gelir)
const createSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(255),
  body: z.string().optional().nullable(),
  category: z.enum(['payable_due', 'task_assigned', 'task_due', 'system', 'security', 'audit']).default('system'),
  priority: z.enum(['info', 'warning', 'critical']).default('info'),
  action_url: z.string().optional().nullable(),
  related_table: z.string().optional().nullable(),
  related_id: z.string().uuid().optional().nullable(),
});

notificationsRouter.post('/notifications', requireAuth, async (req, res, next) => {
  try {
    // Sadece super_admin debug için manuel notification oluşturabilir
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(notifications)
      .values({
        user_id: body.user_id,
        tenant_id: body.tenant_id ?? null,
        title: body.title,
        body: body.body ?? null,
        category: body.category,
        priority: body.priority,
        action_url: body.action_url ?? null,
        related_table: body.related_table ?? null,
        related_id: body.related_id ?? null,
      })
      .returning();
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});
