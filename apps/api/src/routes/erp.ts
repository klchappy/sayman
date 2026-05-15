/**
 * /v1/erp/* — ERP bağlantı yönetimi.
 *
 *   GET    /v1/erp/providers              → desteklenen sağlayıcılar + config fields
 *   GET    /v1/erp/connections            → org'un bağlantıları
 *   POST   /v1/erp/connections            → yeni bağlantı (config_encrypted, secret-box)
 *   PATCH  /v1/erp/connections/:id        → name/status/sync_interval güncelle
 *   DELETE /v1/erp/connections/:id        → sil
 *   POST   /v1/erp/connections/:id/test   → test bağlantı (token al, deneme)
 *   POST   /v1/erp/connections/:id/sync   → manuel tam sync (cari + ekstre)
 *   GET    /v1/erp/connections/:id/logs   → sync history (son 50)
 *
 * Auth: requireOrg + admin role (super_admin / organization_admin).
 */
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { erpConnections, erpSyncLogs, getDb } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import {
  adapterConfigFields,
  getAdapter,
  listAdapters,
} from '../lib/erp';
import { runFullSync } from '../lib/erp/runner';
import { HttpError, requireOrg } from '../lib/helpers';
import { decryptSecret, encryptSecret, secretHint } from '../lib/secret-box';
import { requireAuth } from '../middleware/auth';

export const erpRouter = Router();

function requireAdmin(role?: string | null) {
  if (!['super_admin', 'organization_admin'].includes(role ?? '')) {
    throw new HttpError(403, 'ERP yönetimi için yetki yok', 'FORBIDDEN');
  }
}

erpRouter.get('/erp/providers', requireAuth, requireOrg, async (_req, res, next) => {
  try {
    const adapters = listAdapters();
    res.json({
      data: adapters.map((a) => ({
        ...a,
        config_fields: adapterConfigFields(a.provider),
      })),
    });
  } catch (err) {
    next(err);
  }
});

erpRouter.get('/erp/connections', requireAuth, requireOrg, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: erpConnections.id,
        provider: erpConnections.provider,
        name: erpConnections.name,
        tenant_id: erpConnections.tenant_id,
        public_config: erpConnections.public_config,
        status: erpConnections.status,
        sync_interval_hours: erpConnections.sync_interval_hours,
        last_sync_at: erpConnections.last_sync_at,
        last_sync_status: erpConnections.last_sync_status,
        last_sync_error: erpConnections.last_sync_error,
        sync_count: erpConnections.sync_count,
        created_at: erpConnections.created_at,
      })
      .from(erpConnections)
      .where(eq(erpConnections.organization_id, req.activeOrgId!))
      .orderBy(desc(erpConnections.created_at));
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  provider: z.string().min(2),
  name: z.string().min(2).max(120),
  tenant_id: z.string().uuid().optional().nullable(),
  config: z.record(z.unknown()),
  sync_interval_hours: z.number().min(0).max(24).default(1).optional(),
});

erpRouter.post('/erp/connections', requireAuth, requireOrg, async (req, res, next) => {
  try {
    requireAdmin(req.effectiveRole);
    const body = createSchema.parse(req.body);
    const adapter = getAdapter(body.provider);
    if (!adapter) throw new HttpError(400, `Bilinmeyen sağlayıcı: ${body.provider}`);

    // public_config: secret olmayan alanlar UI'ye geri yollanabilir
    const publicConfig: Record<string, unknown> = {};
    for (const f of adapter.configFields) {
      if (f.type !== 'password' && body.config[f.key] != null) {
        publicConfig[f.key] = body.config[f.key];
      }
    }
    // Password alanları için hint (örn. "abc1...xyz9")
    for (const f of adapter.configFields) {
      if (f.type === 'password' && body.config[f.key]) {
        publicConfig[`${f.key}_hint`] = secretHint(String(body.config[f.key]));
      }
    }

    const configEncrypted = encryptSecret(JSON.stringify(body.config));
    const db = getDb();
    const [row] = await db
      .insert(erpConnections)
      .values({
        organization_id: req.activeOrgId!,
        tenant_id: body.tenant_id ?? null,
        provider: body.provider,
        name: body.name,
        config_encrypted: configEncrypted,
        public_config: publicConfig,
        sync_interval_hours: String(body.sync_interval_hours ?? 1),
      })
      .returning();

    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'erp.connection.create',
      target_type: 'erp_connections',
      target_id: row?.id,
      details: { provider: body.provider, name: body.name },
    });

    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
  sync_interval_hours: z.number().min(0).max(24).optional(),
});

erpRouter.patch('/erp/connections/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    requireAdmin(req.effectiveRole);
    const body = updateSchema.parse(req.body);
    const db = getDb();
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.name) patch.name = body.name;
    if (body.status) patch.status = body.status;
    if (body.sync_interval_hours != null)
      patch.sync_interval_hours = String(body.sync_interval_hours);

    const [row] = await db
      .update(erpConnections)
      .set(patch)
      .where(
        and(
          eq(erpConnections.id, String(req.params.id ?? '')),
          eq(erpConnections.organization_id, req.activeOrgId!),
        ),
      )
      .returning();
    if (!row) throw new HttpError(404, 'Bağlantı bulunamadı');
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

erpRouter.delete('/erp/connections/:id', requireAuth, requireOrg, async (req, res, next) => {
  try {
    requireAdmin(req.effectiveRole);
    const db = getDb();
    const [row] = await db
      .delete(erpConnections)
      .where(
        and(
          eq(erpConnections.id, String(req.params.id ?? '')),
          eq(erpConnections.organization_id, req.activeOrgId!),
        ),
      )
      .returning({ id: erpConnections.id });
    if (!row) throw new HttpError(404, 'Bağlantı bulunamadı');
    await auditFromRequest(req, {
      organization_id: req.activeOrgId!,
      actor_user_id: req.authUser?.id,
      actor_email: req.authUser?.email,
      action: 'erp.connection.delete',
      target_type: 'erp_connections',
      target_id: row.id,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

erpRouter.post(
  '/erp/connections/:id/test',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      requireAdmin(req.effectiveRole);
      const db = getDb();
      const [conn] = await db
        .select()
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.id ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');

      const adapter = getAdapter(conn.provider);
      if (!adapter) throw new HttpError(400, `Bilinmeyen sağlayıcı: ${conn.provider}`);

      const config = JSON.parse(decryptSecret(conn.config_encrypted));
      const result = await adapter.testConnection(config);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

erpRouter.post(
  '/erp/connections/:id/sync',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      requireAdmin(req.effectiveRole);
      const db = getDb();
      const [conn] = await db
        .select({ id: erpConnections.id })
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.id ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');

      const result = await runFullSync(conn.id, 'manual');
      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'erp.connection.sync',
        target_type: 'erp_connections',
        target_id: conn.id,
        details: { ...result },
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

erpRouter.get(
  '/erp/connections/:id/logs',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const [conn] = await db
        .select({ id: erpConnections.id })
        .from(erpConnections)
        .where(
          and(
            eq(erpConnections.id, String(req.params.id ?? '')),
            eq(erpConnections.organization_id, req.activeOrgId!),
          ),
        );
      if (!conn) throw new HttpError(404, 'Bağlantı bulunamadı');

      const rows = await db
        .select()
        .from(erpSyncLogs)
        .where(eq(erpSyncLogs.connection_id, conn.id))
        .orderBy(desc(erpSyncLogs.started_at))
        .limit(50);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);
