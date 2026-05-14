/**
 * /v1/api-tokens — Kullanıcı API tokens (programmatic erişim).
 *
 *   GET    /v1/api-tokens         → kendi token'larım (plain dönmez)
 *   POST   /v1/api-tokens         → yeni token (plain bir kez dönen)
 *   DELETE /v1/api-tokens/:id     → revoke
 *
 * Auth: kullanıcı kendi token'larını yönetir. API token ile bu endpoint'lere
 * erişim engelli — kullanıcının "kendini tanıması" için JWT session lazım.
 */
import crypto from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { apiTokens, getDb } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';

const TOKEN_PREFIX = 'st_';

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  scopes: z.array(z.string()).optional(),
  /** ISO date — opsiyonel expire */
  expires_at: z.string().datetime().optional().nullable(),
});

export const apiTokensRouter = Router();

// LIST — kendi token'larım
apiTokensRouter.get('/api-tokens', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser!;
    if (!me.auth_account_id) {
      // Supabase user'lar için api token yok
      res.json({ data: [], note: 'API token yalnız local auth hesapları için' });
      return;
    }
    const db = getDb();
    const rows = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        token_prefix: apiTokens.token_prefix,
        scopes: apiTokens.scopes,
        expires_at: apiTokens.expires_at,
        last_used_at: apiTokens.last_used_at,
        last_used_ip: apiTokens.last_used_ip,
        revoked_at: apiTokens.revoked_at,
        created_at: apiTokens.created_at,
      })
      .from(apiTokens)
      .where(eq(apiTokens.account_id, me.auth_account_id))
      .orderBy(desc(apiTokens.created_at))
      .limit(100);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// CREATE — yeni token (plain dönen)
apiTokensRouter.post('/api-tokens', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser!;
    if (!me.auth_account_id) {
      throw new HttpError(400, 'Sadece local auth hesapları API token üretebilir', 'LOCAL_ONLY');
    }

    const body = createSchema.parse(req.body);
    const db = getDb();

    // Plain token: "st_" + 32 byte base64url (~43 char)
    const random = crypto.randomBytes(32).toString('base64url');
    const plainToken = `${TOKEN_PREFIX}${random}`;
    const tokenHash = sha256Hex(plainToken);
    const tokenPrefix = plainToken.slice(0, 12); // "st_ABCD1234..." UI'da gösterim

    const [row] = await db
      .insert(apiTokens)
      .values({
        account_id: me.auth_account_id,
        name: body.name,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        scopes: body.scopes ?? [],
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
      })
      .returning({
        id: apiTokens.id,
        name: apiTokens.name,
        token_prefix: apiTokens.token_prefix,
        scopes: apiTokens.scopes,
        expires_at: apiTokens.expires_at,
        created_at: apiTokens.created_at,
      });

    await auditFromRequest(req, {
      actor_user_id: me.id,
      actor_email: me.email,
      action: 'api_token.create',
      target_type: 'api_tokens',
      target_id: row?.id,
      details: { name: body.name, scopes: body.scopes ?? [] },
    });

    // Plain token YALNIZ burada döner — bir daha asla
    res.status(201).json({ data: row, token: plainToken });
  } catch (err) {
    next(err);
  }
});

// DELETE — revoke
apiTokensRouter.delete('/api-tokens/:id', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser!;
    if (!me.auth_account_id) {
      throw new HttpError(400, 'Local auth gerekli', 'LOCAL_ONLY');
    }
    const db = getDb();
    const [row] = await db
      .update(apiTokens)
      .set({ revoked_at: new Date(), updated_at: new Date() })
      .where(
        and(
          eq(apiTokens.id, String(req.params.id ?? '')),
          eq(apiTokens.account_id, me.auth_account_id),
          isNull(apiTokens.revoked_at),
        ),
      )
      .returning({ id: apiTokens.id });
    if (!row) throw new HttpError(404, 'Token bulunamadı veya zaten iptal edildi', 'NOT_FOUND');

    await auditFromRequest(req, {
      actor_user_id: me.id,
      actor_email: me.email,
      action: 'api_token.revoke',
      target_type: 'api_tokens',
      target_id: row.id,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
