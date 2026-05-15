/**
 * /v1/tasks — Görev yönetimi (tenant-scope).
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, tasks } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { LIST_LIMITS, countTotal, listMeta } from '../lib/list-meta';
import { requireAuth } from '../middleware/auth';

const priorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
const statusEnum = z.enum(['new', 'in_progress', 'waiting', 'postponed', 'done', 'cancelled']);

const createSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().optional().nullable(),
  priority: priorityEnum.default('normal'),
  status: statusEnum.default('new'),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  related_table: z.string().max(64).optional().nullable(),
  related_id: z.string().uuid().optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  completed_at: z.string().datetime({ offset: true }).optional().nullable(),
  postponed_until: z.string().datetime({ offset: true }).optional().nullable(),
  postpone_reason: z.string().optional().nullable(),
});

export const tasksRouter = Router();

tasksRouter.get('/tasks', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const status = req.query['status'] as string | undefined;
    const assignedToMe = req.query['mine'] === 'true';

    const conditions = [eq(tasks.tenant_id, req.activeTenantId!), eq(tasks.is_active, true)];
    if (status) conditions.push(eq(tasks.status, status as never));
    if (assignedToMe) conditions.push(eq(tasks.assigned_to, req.authUserId!));

    const where = and(...conditions);
    const rows = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(asc(tasks.due_date), desc(tasks.created_at))
      .limit(LIST_LIMITS.medium);
    const total = await countTotal(tasks, where);
    res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.medium) });
  } catch (err) {
    next(err);
  }
});

tasksRouter.post('/tasks', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    const [row] = await db
      .insert(tasks)
      .values({
        tenant_id: req.activeTenantId!,
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        status: body.status,
        assigned_to: body.assigned_to ?? null,
        due_date: body.due_date ? new Date(body.due_date) : null,
        related_table: body.related_table ?? null,
        related_id: body.related_id ?? null,
        created_by: req.authUserId,
      })
      .returning();

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      actor_email: req.authUser?.email,
      action: 'task.create',
      target_type: 'tasks',
      target_id: row?.id,
      details: { title: body.title },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch('/tasks/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const db = getDb();

    const updateData: Record<string, unknown> = { ...body, updated_at: new Date() };
    if (body.due_date) updateData['due_date'] = new Date(body.due_date);
    if (body.completed_at) updateData['completed_at'] = new Date(body.completed_at);
    if (body.postponed_until) updateData['postponed_until'] = new Date(body.postponed_until);

    // Status done → completed_at auto-set
    if (body.status === 'done' && !body.completed_at) {
      updateData['completed_at'] = new Date();
    }

    const [row] = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, String(req.params.id ?? '')), eq(tasks.tenant_id, req.activeTenantId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Görev bulunamadı');

    await auditFromRequest(req, {
      actor_user_id: req.authUserId,
      action: 'task.update',
      target_type: 'tasks',
      target_id: row.id,
      details: { status: body.status },
    });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete('/tasks/:id', requireAuth, requireTenant, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .update(tasks)
      .set({ is_active: false, status: 'cancelled', updated_at: new Date() })
      .where(and(eq(tasks.id, String(req.params.id ?? '')), eq(tasks.tenant_id, req.activeTenantId!)))
      .returning();
    if (!row) throw new HttpError(404, 'Görev bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});
