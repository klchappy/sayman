/**
 * /v1/push — Mobil/web push token kaydı.
 *
 *   POST /v1/push/tokens          → token kaydet (idempotent)
 *   DELETE /v1/push/tokens/:id    → cihazı çıkar
 *   GET    /v1/push/tokens        → kullanıcının kayıtlı cihazları
 *
 * MVP: sadece register/list/delete. Actual FCM/APNs send entegrasyonu sonra
 * (Firebase Admin SDK kullanılacak). Şu an cihazlar listelenebiliyor.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, pushTokens } from '@sayman/db';
import { HttpError } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

export const pushRouter = Router();

const registerSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
  app_version: z.string().max(50).optional(),
});

pushRouter.post('/push/tokens', requireAuth, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const db = getDb();
    const userId = req.authUser!.id;

    // Idempotent: aynı token zaten varsa last_seen_at güncelle
    const existing = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, body.token));

    if (existing.length > 0) {
      const [updated] = await db
        .update(pushTokens)
        .set({ last_seen_at: new Date(), app_version: body.app_version ?? null })
        .where(eq(pushTokens.token, body.token))
        .returning();
      res.json({ data: updated, status: 'updated' });
      return;
    }

    const [row] = await db
      .insert(pushTokens)
      .values({
        user_id: userId,
        platform: body.platform,
        token: body.token,
        app_version: body.app_version ?? null,
      })
      .returning();
    res.status(201).json({ data: row, status: 'created' });
  } catch (err) {
    next(err);
  }
});

pushRouter.get('/push/tokens', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: pushTokens.id,
        platform: pushTokens.platform,
        app_version: pushTokens.app_version,
        last_seen_at: pushTokens.last_seen_at,
        created_at: pushTokens.created_at,
      })
      .from(pushTokens)
      .where(eq(pushTokens.user_id, req.authUser!.id))
      .orderBy(desc(pushTokens.last_seen_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

pushRouter.delete('/push/tokens/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .delete(pushTokens)
      .where(
        and(
          eq(pushTokens.id, String(req.params.id ?? '')),
          eq(pushTokens.user_id, req.authUser!.id),
        ),
      )
      .returning({ id: pushTokens.id });
    if (!row) throw new HttpError(404, 'Cihaz bulunamadı');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
