/**
 * /v1/realtime/notifications — Server-Sent Events (SSE) ile real-time bildirim akışı.
 *
 * Kullanım:
 *   const es = new EventSource('https://api.sayman.deploi.net/v1/realtime/notifications?token=<JWT>');
 *   es.addEventListener('notification', (ev) => console.log(JSON.parse(ev.data)));
 *
 * Auth: query param `?token=` (EventSource header gönderemediği için).
 * Server her 5 sn'de bir kullanıcının yeni bildirimlerini kontrol eder + push eder.
 * Production'da BullMQ/Redis pub-sub ile değiştirilebilir; şu an polling-based SSE.
 */
import { and, eq, gt } from 'drizzle-orm';
import { Router } from 'express';
import { getDb, notifications, users } from '@sayman/db';
import { verifyLocalJwt } from '../lib/local-auth';

const POLL_MS = 5000;
const KEEPALIVE_MS = 30_000;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 dk sonra client reconnect

export const realtimeRouter = Router();

realtimeRouter.get('/realtime/notifications', async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) {
    res.status(401).json({ error: 'token query param gerekli' });
    return;
  }

  // Auth: token verify (local JWT veya API token)
  let userId: string | null = null;
  if (token.startsWith('st_')) {
    // API token destekleme — basit doğrulama
    const crypto = await import('node:crypto');
    const { apiTokens } = await import('@sayman/db');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = getDb();
    const [t] = await db.select().from(apiTokens).where(eq(apiTokens.token_hash, tokenHash));
    if (!t || t.revoked_at) {
      res.status(401).json({ error: 'invalid api token' });
      return;
    }
    const [u] = await db.select().from(users).where(eq(users.auth_account_id, t.account_id));
    if (!u) {
      res.status(401).json({ error: 'user not found' });
      return;
    }
    userId = u.id;
  } else {
    const result = await verifyLocalJwt(token);
    if (!result.ok || !result.user) {
      res.status(401).json({ error: 'invalid token' });
      return;
    }
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.auth_account_id, result.user.id));
    if (!u) {
      res.status(401).json({ error: 'user not found' });
      return;
    }
    userId = u.id;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx
  res.flushHeaders?.();

  res.write(`: connected — Sayman SSE\n\n`);

  let lastCheck = new Date();
  const startTime = Date.now();

  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const poll = async () => {
    if (Date.now() - startTime > MAX_DURATION_MS) {
      sendEvent('close', { reason: 'max_duration' });
      res.end();
      return;
    }
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.user_id, userId!), gt(notifications.created_at, lastCheck)))
        .limit(20);
      for (const n of rows) {
        sendEvent('notification', {
          id: n.id,
          title: n.title,
          body: n.body,
          category: n.category,
          priority: n.priority,
          action_url: n.action_url,
          related_table: n.related_table,
          related_id: n.related_id,
          created_at: n.created_at,
        });
        if (n.created_at > lastCheck) lastCheck = n.created_at;
      }
    } catch {
      // sessiz — bağlantı kopuk olabilir
    }
  };

  const pollInterval = setInterval(poll, POLL_MS);
  const keepAliveInterval = setInterval(() => res.write(`: keepalive\n\n`), KEEPALIVE_MS);

  req.on('close', () => {
    clearInterval(pollInterval);
    clearInterval(keepAliveInterval);
  });
});
