/**
 * /v1/saved-searches — Kullanıcının kayıtlı filtreleri.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, savedSearches } from '@sayman/db';
import { HttpError } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const savedSearchesRouter = Router();

savedSearchesRouter.get('/saved-searches', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const conditions: any[] = [eq(savedSearches.user_id, req.authUser!.id)];
    if (req.query.module) conditions.push(eq(savedSearches.module, String(req.query.module)));

    const rows = await db
      .select()
      .from(savedSearches)
      .where(and(...conditions))
      .orderBy(desc(savedSearches.is_pinned), desc(savedSearches.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  module: z.string().min(2).max(50),
  name: z.string().min(2).max(120),
  filters: z.record(z.unknown()).default({}),
  is_pinned: z.boolean().default(false),
});

savedSearchesRouter.post('/saved-searches', requireAuth, async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const db = getDb();
    try {
      const [row] = await db
        .insert(savedSearches)
        .values({
          user_id: req.authUser!.id,
          tenant_id: req.activeTenantId ?? null,
          module: body.module,
          name: body.name,
          filters: body.filters,
          is_pinned: body.is_pinned,
        })
        .returning();
      res.status(201).json({ data: row });
    } catch (err) {
      if ((err as Error).message.includes('uq_saved_searches')) {
        throw new HttpError(409, 'Bu isim bu modülde zaten kayıtlı');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  filters: z.record(z.unknown()).optional(),
  is_pinned: z.boolean().optional(),
});

savedSearchesRouter.patch('/saved-searches/:id', requireAuth, async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const db = getDb();
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.name) patch.name = body.name;
    if (body.filters) patch.filters = body.filters;
    if (body.is_pinned != null) patch.is_pinned = body.is_pinned;

    const [row] = await db
      .update(savedSearches)
      .set(patch)
      .where(
        and(
          eq(savedSearches.id, String(req.params.id ?? '')),
          eq(savedSearches.user_id, req.authUser!.id),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Kayıtlı filtre bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

savedSearchesRouter.delete('/saved-searches/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .delete(savedSearches)
      .where(
        and(
          eq(savedSearches.id, String(req.params.id ?? '')),
          eq(savedSearches.user_id, req.authUser!.id),
        ),
      )
      .returning({ id: savedSearches.id });
    if (!row) throw new HttpError(404, 'Kayıtlı filtre bulunamadı');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
