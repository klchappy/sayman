/**
 * API helpers — tenant scope + share_scope filtering + organization gate.
 */
import { eq, sql, type SQL } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { getDb, tenants, userOrganizationRoles, userTenantOverrides, organizations } from '@sayman/db';

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * requireOrg — auth + saymanContext'ten org çözümle + kullanıcının o org'da rolü olduğunu doğrula.
 * Kullanım: app.get('/path', requireAuth, requireOrg, handler)
 */
export async function requireOrg(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.authUser;
    if (!user) throw new HttpError(401, 'Auth gerekli', 'NO_AUTH');

    const ctx = req.saymanContext;
    if (!ctx?.organizationId) {
      throw new HttpError(400, 'Organization context yok — header X-Sayman-Org veya subdomain gerekli', 'NO_ORG');
    }

    const db = getDb();
    const [orgRole] = await db
      .select()
      .from(userOrganizationRoles)
      .where(
        sql`${userOrganizationRoles.user_id} = ${user.id} AND ${userOrganizationRoles.organization_id} = ${ctx.organizationId}`,
      );
    if (!orgRole) throw new HttpError(403, 'Bu organization\'da yetkin yok', 'NOT_MEMBER');

    req.activeOrgId = ctx.organizationId;
    req.activeOrgSlug = ctx.orgSlug ?? undefined;
    req.effectiveRole = orgRole.role;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireTenant — requireOrg + tenant çözümle + tenant override varsa effectiveRole'u override et.
 */
export async function requireTenant(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.authUser;
    if (!user) throw new HttpError(401, 'Auth gerekli', 'NO_AUTH');

    const ctx = req.saymanContext;
    if (!ctx?.tenantId || !ctx?.organizationId) {
      throw new HttpError(400, 'Tenant context yok — header X-Sayman-Tenant + X-Sayman-Org veya subdomain', 'NO_TENANT');
    }

    const db = getDb();

    const [orgRole] = await db
      .select()
      .from(userOrganizationRoles)
      .where(
        sql`${userOrganizationRoles.user_id} = ${user.id} AND ${userOrganizationRoles.organization_id} = ${ctx.organizationId}`,
      );
    if (!orgRole) throw new HttpError(403, 'Organization üyesi değilsin', 'NOT_MEMBER');

    const [override] = await db
      .select()
      .from(userTenantOverrides)
      .where(
        sql`${userTenantOverrides.user_id} = ${user.id} AND ${userTenantOverrides.tenant_id} = ${ctx.tenantId}`,
      );

    const effective = override?.value ?? orgRole.role;
    if (effective === 'deny') {
      throw new HttpError(403, 'Bu tenant\'a erişimin kapatıldı', 'TENANT_DENIED');
    }

    req.activeOrgId = ctx.organizationId;
    req.activeOrgSlug = ctx.orgSlug ?? undefined;
    req.activeTenantId = ctx.tenantId;
    req.activeTenantSlug = ctx.tenantSlug ?? undefined;
    req.effectiveRole = effective;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * shareScopeWhere — master data filtresi: kayıt aktif tenant'a görünür mü?
 *   share_scope = '"*"'              → herkese görünür
 *   share_scope = '["a","b"]'        → sadece "a" veya "b" tenant'larına görünür
 */
export function shareScopeWhereSQL(tenantSlug: string): SQL {
  // share_scope @> '"*"' OR share_scope @> jsonb_build_array(tenantSlug)
  return sql`(share_scope = '"*"'::jsonb OR share_scope @> ${JSON.stringify([tenantSlug])}::jsonb)`;
}
