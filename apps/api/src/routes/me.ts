/**
 * /v1/me — giriş yapmış kullanıcının profili + organization rolleri + tenant override'ları.
 *
 * Frontend bu endpoint'i login sonrası çağırır:
 *   - Hangi organization'lara üye olduğunu görür
 *   - Her organization'da default rolü ne
 *   - Hangi tenant'ta hangi override var
 *
 * Tenant switcher UI'ı bu cevabı kullanır.
 */
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import {
  getDb,
  organizations,
  tenants,
  userOrganizationRoles,
  userTenantOverrides,
} from '@sayman/db';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.authUser!;
    const db = getDb();

    const orgRoles = await db
      .select({
        organization_id: userOrganizationRoles.organization_id,
        role: userOrganizationRoles.role,
        organization: organizations,
      })
      .from(userOrganizationRoles)
      .innerJoin(organizations, eq(organizations.id, userOrganizationRoles.organization_id))
      .where(eq(userOrganizationRoles.user_id, user.id));

    const overrides = await db
      .select({
        tenant_id: userTenantOverrides.tenant_id,
        value: userTenantOverrides.value,
        tenant: tenants,
      })
      .from(userTenantOverrides)
      .innerJoin(tenants, eq(tenants.id, userTenantOverrides.tenant_id))
      .where(eq(userTenantOverrides.user_id, user.id));

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
        },
        organizations: orgRoles.map((r) => ({
          id: r.organization.id,
          slug: r.organization.slug,
          name: r.organization.name,
          plan: r.organization.plan,
          role: r.role,
        })),
        tenant_overrides: overrides.map((o) => ({
          tenant_id: o.tenant_id,
          tenant_slug: o.tenant.slug,
          tenant_name: o.tenant.name,
          organization_id: o.tenant.organization_id,
          value: o.value,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});
