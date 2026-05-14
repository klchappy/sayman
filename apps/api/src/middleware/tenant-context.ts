/**
 * Tenant context middleware.
 *
 * Subdomain'den organization+tenant slug'larını çözüp request'e yapıştırır.
 *
 * Beklenen host formatı:
 *   {tenant_slug}.{org_slug}.sayman.deploi.net  (prod)
 *   {tenant_slug}.{org_slug}.localhost          (lokal dev)
 *
 * Ayrıca explicit header'lar da kabul edilir (Postman / SDK için):
 *   X-Sayman-Org:    kilic
 *   X-Sayman-Tenant: tekstil
 *
 * Public schema (org/tenant resolve olmadan) için: ana domain veya bilinmeyen host.
 *
 * Not: bu Faz A.0 minimum implementasyonu. JWT auth + role check Faz B'de.
 */
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { getDb, organizations, tenants } from '@sayman/db';

function parseSubdomains(host: string): { tenant: string | null; org: string | null } {
  // Host örnek: "tekstil.kilic.localhost:4100" → ["tekstil","kilic","localhost:4100"]
  // Port kısmı temizle
  const hostname = host.split(':')[0] ?? '';
  const parts = hostname.split('.');

  // En az 3 parça: {tenant}.{org}.{base}
  if (parts.length >= 3) {
    return { tenant: parts[0] ?? null, org: parts[1] ?? null };
  }
  return { tenant: null, org: null };
}

export const tenantContext: RequestHandler = async (req, _res, next) => {
  try {
    const host = (req.headers.host as string) ?? '';
    const headerOrg = (req.headers['x-sayman-org'] as string | undefined)?.toLowerCase();
    const headerTenant = (req.headers['x-sayman-tenant'] as string | undefined)?.toLowerCase();

    const subdomains = parseSubdomains(host);
    const orgSlug = headerOrg ?? subdomains.org;
    const tenantSlug = headerTenant ?? subdomains.tenant;

    let organizationId: string | null = null;
    let tenantId: string | null = null;

    if (orgSlug) {
      const db = getDb();
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug));
      organizationId = org?.id ?? null;

      if (organizationId && tenantSlug) {
        // Slug org-bagiminda unique — slug + organization_id ile resolve et
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(and(eq(tenants.slug, tenantSlug), eq(tenants.organization_id, organizationId)));
        if (tenant) {
          tenantId = tenant.id;
        }
      }
    }

    req.saymanContext = { orgSlug, tenantSlug, organizationId, tenantId };
    next();
  } catch (err) {
    next(err);
  }
};
