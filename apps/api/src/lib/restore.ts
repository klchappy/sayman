/**
 * Restore helper — soft-deleted (is_active=false) bir kaydı geri yükler.
 *
 * Pattern:
 *   POST /v1/<resource>/:id/restore
 *   Body: opsiyonel { new_status?: string }
 *
 * Auth: super_admin / organization_admin / yonetici
 * Audit: her restore log'a kaydedilir
 *
 * Kullanım:
 *   payablesRouter.post('/payables/:id/restore', requireAuth, requireTenant,
 *     restoreHandler({ table: payableItems, entity: 'payable', resetStatus: 'pending' }));
 */
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '@sayman/db';
import { auditFromRequest } from './audit';
import { HttpError } from './helpers';

const RESTORE_ROLES = new Set(['super_admin', 'organization_admin', 'yonetici']);

interface RestoreConfig {
  /** Drizzle table reference */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  /** Entity slug — audit + error mesajı için (örn 'payable', 'sales_invoice') */
  entity: string;
  /** Restore sonrası status (varsa) — örn 'pending' (cancelled'dan döndürürken) */
  resetStatus?: string | null;
  /** Tenant kontrolü gerekiyor mu (org-level entityler için false) */
  scope: 'tenant' | 'org';
}

export function restoreHandler(cfg: RestoreConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!RESTORE_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Geri yükleme yetkisi yok', 'FORBIDDEN');
      }

      const id = String(req.params.id ?? '');
      const db = getDb();

      const scopeFilter =
        cfg.scope === 'tenant'
          ? eq(cfg.table.tenant_id, req.activeTenantId!)
          : eq(cfg.table.organization_id, req.activeOrgId!);

      // Önce var mı kontrol et — soft-deleted olmalı, yoksa zaten aktif
      const [existing] = await db
        .select()
        .from(cfg.table)
        .where(and(eq(cfg.table.id, id), scopeFilter));
      if (!existing) {
        throw new HttpError(404, `${cfg.entity} bulunamadı`, 'NOT_FOUND');
      }
      if (existing.is_active === true) {
        throw new HttpError(
          400,
          `${cfg.entity} zaten aktif (silinmiş değil)`,
          'ALREADY_ACTIVE',
        );
      }

      // Restore: is_active=true + opsiyonel status reset
      const patch: Record<string, unknown> = {
        is_active: true,
        updated_at: new Date(),
      };
      if (cfg.resetStatus !== undefined && cfg.resetStatus !== null) {
        patch.status = cfg.resetStatus;
      }

      const [row] = await db
        .update(cfg.table)
        .set(patch)
        .where(and(eq(cfg.table.id, id), scopeFilter))
        .returning();

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: `${cfg.entity}.restore`,
        target_type: cfg.entity,
        target_id: id,
        details: { reset_status: cfg.resetStatus ?? null },
      });

      res.json({ data: row, ok: true });
    } catch (err) {
      next(err);
    }
  };
}
