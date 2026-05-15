/**
 * /v1/integrations/credentials — Org-default + tenant-override credential yönetimi.
 *
 *   GET    /v1/integrations/credentials             → tüm servisler için durum
 *   GET    /v1/integrations/credentials/:key        → tek servis için credential bilgisi (masked)
 *   PUT    /v1/integrations/credentials/:key        → credential yaz (scope: org veya tenant)
 *   DELETE /v1/integrations/credentials/:key        → credential sil (scope belirtilir)
 *   POST   /v1/integrations/credentials/:key/test   → credential test et (optional, per integration)
 *
 * Scope kuralı: body.scope = 'org' → tenant_id NULL · scope = 'tenant' → req.activeTenantId
 *
 * Sadece super_admin, organization_admin, yonetici yazabilir.
 */
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, integrationCredentials } from '@sayman/db';
import { auditFromRequest } from '../lib/audit';
import { HttpError, requireOrg } from '../lib/helpers';
import { encryptMap } from '../lib/integration-credentials';
import { requireAuth } from '../middleware/auth';

export const integrationCredentialsRouter = Router();

const WRITE_ROLES = new Set(['super_admin', 'organization_admin', 'yonetici']);

/** Maskeleme: "sk-abc123def456" → "sk-a...f456" */
function mask(value: string): string {
  if (!value || value.length < 8) return '****';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

// ---------------------------------------------------------------------------
// GET /v1/integrations/credentials — özet (her servis için kaç yapılandırma var)
// ---------------------------------------------------------------------------
integrationCredentialsRouter.get(
  '/integrations/credentials',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          integration_key: integrationCredentials.integration_key,
          tenant_id: integrationCredentials.tenant_id,
          is_active: integrationCredentials.is_active,
          updated_at: integrationCredentials.updated_at,
        })
        .from(integrationCredentials)
        .where(eq(integrationCredentials.organization_id, req.activeOrgId!))
        .orderBy(asc(integrationCredentials.integration_key));

      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/integrations/credentials/:key — tek servis: org default + tenant override(lar)
//   Credential değerleri maskelenmiş gösterilir (asla plaintext dönmez).
// ---------------------------------------------------------------------------
integrationCredentialsRouter.get(
  '/integrations/credentials/:key',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      const key = String(req.params.key ?? '');
      const db = getDb();
      const rows = await db
        .select()
        .from(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.organization_id, req.activeOrgId!),
            eq(integrationCredentials.integration_key, key),
          ),
        );

      const items = rows.map((r) => {
        const credMap = (r.credentials as Record<string, unknown>) ?? {};
        const masked: Record<string, string> = {};
        for (const [k, v] of Object.entries(credMap)) {
          if (typeof v !== 'string') continue;
          // v1:... formatı şifreli → maskele
          if (v.startsWith('v1:')) {
            // şifreli format → görünmesin gerçek değer, sadece tanımlı işaret
            masked[k] = '••••••••';
          } else {
            // plaintext (eski kayıt) → maskele
            masked[k] = mask(v);
          }
        }
        return {
          id: r.id,
          scope: r.tenant_id ? 'tenant' : 'org',
          tenant_id: r.tenant_id,
          is_active: r.is_active,
          credentials_masked: masked,
          credential_keys: Object.keys(credMap),
          metadata: r.metadata,
          updated_at: r.updated_at,
        };
      });

      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /v1/integrations/credentials/:key — yaz (upsert)
// ---------------------------------------------------------------------------

const writeSchema = z.object({
  scope: z.enum(['org', 'tenant']),
  credentials: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

integrationCredentialsRouter.put(
  '/integrations/credentials/:key',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!WRITE_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yapılandırma yetkisi yok', 'FORBIDDEN');
      }

      const key = String(req.params.key ?? '');
      const body = writeSchema.parse(req.body);
      const db = getDb();

      if (body.scope === 'tenant' && !req.activeTenantId) {
        throw new HttpError(
          400,
          'Tenant-scope yapılandırma için tenant context gerekli (X-Sayman-Tenant)',
          'NO_TENANT',
        );
      }

      // Boş değerleri eski şifreli halinden temizleme yerine: zaten encryptMap boş atlar
      const encrypted = encryptMap(body.credentials);
      if (Object.keys(encrypted).length === 0) {
        throw new HttpError(400, 'En az 1 alan dolu olmalı', 'EMPTY_CREDENTIALS');
      }

      const targetTenantId = body.scope === 'tenant' ? req.activeTenantId! : null;

      // Mevcut row var mı?
      const existing = targetTenantId
        ? await db
            .select()
            .from(integrationCredentials)
            .where(
              and(
                eq(integrationCredentials.organization_id, req.activeOrgId!),
                eq(integrationCredentials.tenant_id, targetTenantId),
                eq(integrationCredentials.integration_key, key),
              ),
            )
        : await db
            .select()
            .from(integrationCredentials)
            .where(
              and(
                eq(integrationCredentials.organization_id, req.activeOrgId!),
                isNull(integrationCredentials.tenant_id),
                eq(integrationCredentials.integration_key, key),
              ),
            );

      let row;
      if (existing.length > 0) {
        const current = existing[0]!;
        // Mevcut credentials'a yeni alanları ekle (overwrite)
        const merged = {
          ...(current.credentials as Record<string, unknown>),
          ...encrypted,
        };
        [row] = await db
          .update(integrationCredentials)
          .set({
            credentials: merged,
            metadata: body.metadata ?? current.metadata,
            is_active: true,
            updated_at: new Date(),
          })
          .where(eq(integrationCredentials.id, current.id))
          .returning();
      } else {
        [row] = await db
          .insert(integrationCredentials)
          .values({
            organization_id: req.activeOrgId!,
            tenant_id: targetTenantId,
            integration_key: key,
            credentials: encrypted,
            metadata: body.metadata ?? {},
            created_by: req.authUser?.id ?? null,
          })
          .returning();
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'integration.credentials_updated',
        target_type: 'integration_credentials',
        target_id: row!.id,
        details: {
          integration_key: key,
          scope: body.scope,
          tenant_id: targetTenantId,
          fields: Object.keys(body.credentials),
        },
      });

      res.json({
        data: { id: row!.id, scope: body.scope, integration_key: key },
        message:
          body.scope === 'org'
            ? `${key} org-default credentials kaydedildi — tüm şirketler kullanır.`
            : `${key} sadece bu şirket için özel olarak kaydedildi.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /v1/integrations/credentials/:key?scope=org|tenant — kaldır
// ---------------------------------------------------------------------------
integrationCredentialsRouter.delete(
  '/integrations/credentials/:key',
  requireAuth,
  requireOrg,
  async (req, res, next) => {
    try {
      if (!WRITE_ROLES.has(req.effectiveRole ?? '')) {
        throw new HttpError(403, 'Yetki yok', 'FORBIDDEN');
      }

      const key = String(req.params.key ?? '');
      const scope = String(req.query.scope ?? 'tenant');
      const db = getDb();

      const targetTenantId =
        scope === 'tenant' ? req.activeTenantId : null;

      if (scope === 'tenant' && !targetTenantId) {
        throw new HttpError(400, 'Tenant context gerekli', 'NO_TENANT');
      }

      const [removed] = await db
        .delete(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.organization_id, req.activeOrgId!),
            eq(integrationCredentials.integration_key, key),
            targetTenantId
              ? eq(integrationCredentials.tenant_id, targetTenantId)
              : isNull(integrationCredentials.tenant_id),
          ),
        )
        .returning({ id: integrationCredentials.id });

      if (!removed) {
        throw new HttpError(404, 'Kayıt bulunamadı', 'NOT_FOUND');
      }

      await auditFromRequest(req, {
        organization_id: req.activeOrgId!,
        actor_user_id: req.authUser?.id,
        actor_email: req.authUser?.email,
        action: 'integration.credentials_deleted',
        target_type: 'integration_credentials',
        target_id: removed.id,
        details: { integration_key: key, scope },
      });

      res.json({
        ok: true,
        message:
          scope === 'org'
            ? `${key} org-default kaldırıldı. Tenant-özel kayıtlar varsa onlar geçerli olur.`
            : `${key} sadece bu şirket için kaldırıldı. Org default'una düşülür.`,
      });
    } catch (err) {
      next(err);
    }
  },
);
