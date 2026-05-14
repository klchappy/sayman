/**
 * /v1/subsidiaries — Tenant içinde yan şirket / şube CRUD (Faz M).
 *
 *   GET    /v1/subsidiaries          → tenant'taki tüm subsidiary'ler
 *   POST   /v1/subsidiaries          → yeni (yonetici+)
 *   PATCH  /v1/subsidiaries/:id      → güncelle
 *   DELETE /v1/subsidiaries/:id      → soft delete
 */
import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, subsidiaries } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireTenant } from '../lib/helpers';
import { requireAuth } from '../middleware/auth';
import { requirePerm } from '../middleware/permission';

const createSchema = z.object({
  name: z.string().min(2).max(200),
  code: z
    .string()
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam, tire')
    .optional()
    .nullable(),
  description: z.string().max(1000).optional().nullable(),
  parent_subsidiary_id: z.string().uuid().optional().nullable(),
  color: z.string().max(16).optional().nullable(),
  sort_order: z.string().max(16).optional().nullable(),
});
const updateSchema = createSchema.partial();

export const subsidiariesRouter = Router();

// LIST
subsidiariesRouter.get(
  '/subsidiaries',
  requireAuth,
  requireTenant,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(subsidiaries)
        .where(eq(subsidiaries.tenant_id, req.activeTenantId!))
        .orderBy(asc(subsidiaries.name));
      res.json({ data: rows, count: rows.length });
    } catch (err) {
      next(err);
    }
  },
);

// CREATE
subsidiariesRouter.post(
  '/subsidiaries',
  requireAuth,
  requireTenant,
  requirePerm('master_data.write'),
  async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const db = getDb();

      // parent_subsidiary_id varsa aynı tenant'a ait mi?
      if (body.parent_subsidiary_id) {
        const [parent] = await db
          .select()
          .from(subsidiaries)
          .where(
            and(
              eq(subsidiaries.id, body.parent_subsidiary_id),
              eq(subsidiaries.tenant_id, req.activeTenantId!),
            ),
          );
        if (!parent) throw new HttpError(400, 'Parent subsidiary bu tenantta yok', 'INVALID_PARENT');
      }

      const [row] = await db
        .insert(subsidiaries)
        .values({ tenant_id: req.activeTenantId!, ...body })
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'subsidiary.create',
        target_type: 'subsidiaries',
        target_id: row?.id,
        details: { name: body.name, code: body.code ?? null },
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// UPDATE
subsidiariesRouter.patch(
  '/subsidiaries/:id',
  requireAuth,
  requireTenant,
  requirePerm('master_data.write'),
  async (req, res, next) => {
    try {
      const body = updateSchema.parse(req.body);
      const db = getDb();
      const [row] = await db
        .update(subsidiaries)
        .set({ ...body, updated_at: new Date() })
        .where(
          and(
            eq(subsidiaries.id, String(req.params.id ?? '')),
            eq(subsidiaries.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Yan şirket bulunamadı', 'NOT_FOUND');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'subsidiary.update',
        target_type: 'subsidiaries',
        target_id: row.id,
        details: body,
      });

      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE (soft)
subsidiariesRouter.delete(
  '/subsidiaries/:id',
  requireAuth,
  requireTenant,
  requirePerm('master_data.delete'),
  async (req, res, next) => {
    try {
      const db = getDb();
      const [row] = await db
        .update(subsidiaries)
        .set({ is_active: false, updated_at: new Date() })
        .where(
          and(
            eq(subsidiaries.id, String(req.params.id ?? '')),
            eq(subsidiaries.tenant_id, req.activeTenantId!),
          ),
        )
        .returning();
      if (!row) throw new HttpError(404, 'Yan şirket bulunamadı', 'NOT_FOUND');

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'subsidiary.delete',
        target_type: 'subsidiaries',
        target_id: row.id,
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
