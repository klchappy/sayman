/**
 * Integration credentials helper — org-default + tenant-override + env-fallback.
 *
 * Servis çağrılarında env'e direkt erişmek yerine bu helper kullanılır.
 * Böylece kullanıcı UI'dan yapılandırma yapınca env restart gerekmez.
 *
 * Lookup chain:
 *   1. tenant_id = X kayıt varsa → onu döner
 *   2. tenant_id IS NULL + org_id = X kayıt varsa → onu döner (org default)
 *   3. envFallback parametresi varsa → onu döner
 *   4. null
 *
 * Credentials JSONB AES-GCM şifrelenmiş alanlar içerir:
 *   { api_key: "v1:iv:tag:ct", ... }
 * Plaintext döndürmek için decrypt edilir.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb, integrationCredentials } from '@sayman/db';
import { logger } from '../config/logger';
import { decryptSecret, encryptSecret } from './secret-box';

export interface CredentialLookup {
  organizationId: string;
  tenantId?: string | null;
  integrationKey: string;
}

export interface CredentialResolved {
  /** Plaintext credential map (decrypt edildi) */
  credentials: Record<string, string>;
  /** Bu credential nereden geldi: 'tenant' | 'org' | 'env' | 'none' */
  source: 'tenant' | 'org' | 'env' | 'none';
  /** Hangi tenant_id'den geldi (varsa) */
  tenantId?: string | null;
}

/**
 * Şifreli credential map'i decrypt et — alan başına v1:... formatı varsa decrypt et.
 * Eğer plaintext gibi gözüküyorsa olduğu gibi bırak (legacy uyumluluk).
 */
function decryptMap(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string') continue;
    if (v.startsWith('v1:')) {
      try {
        out[k] = decryptSecret(v);
      } catch (err) {
        logger.warn({ err, key: k }, 'credential decrypt failed');
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Tüm değer alanlarını şifrele. Boş string'leri atla.
 */
export function encryptMap(plain: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(plain)) {
    if (!v || v.trim() === '') continue;
    out[k] = encryptSecret(v);
  }
  return out;
}

/**
 * Lookup chain ile credentials çek. envFallback varsa onu kullanır.
 */
export async function getIntegrationCredentials(
  lookup: CredentialLookup,
  envFallback?: Record<string, string | undefined>,
): Promise<CredentialResolved> {
  const db = getDb();
  const rows = await db
    .select({
      tenant_id: integrationCredentials.tenant_id,
      credentials: integrationCredentials.credentials,
    })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organization_id, lookup.organizationId),
        eq(integrationCredentials.integration_key, lookup.integrationKey),
        eq(integrationCredentials.is_active, true),
        lookup.tenantId
          ? or(
              eq(integrationCredentials.tenant_id, lookup.tenantId),
              isNull(integrationCredentials.tenant_id),
            )
          : isNull(integrationCredentials.tenant_id),
      ),
    );

  // Tenant override önce
  const tenantRow = rows.find((r) => r.tenant_id === lookup.tenantId && lookup.tenantId);
  if (tenantRow) {
    return {
      credentials: decryptMap(tenantRow.credentials as Record<string, unknown>),
      source: 'tenant',
      tenantId: tenantRow.tenant_id,
    };
  }

  // Org default
  const orgRow = rows.find((r) => r.tenant_id === null);
  if (orgRow) {
    return {
      credentials: decryptMap(orgRow.credentials as Record<string, unknown>),
      source: 'org',
      tenantId: null,
    };
  }

  // Env fallback (legacy uyumluluk)
  if (envFallback) {
    const filtered = Object.fromEntries(
      Object.entries(envFallback).filter(([, v]) => v && v.length > 0),
    ) as Record<string, string>;
    if (Object.keys(filtered).length > 0) {
      return { credentials: filtered, source: 'env' };
    }
  }

  return { credentials: {}, source: 'none' };
}

/**
 * Sadece tek bir credential field'ı çekmek için shortcut.
 */
export async function getCredentialField(
  lookup: CredentialLookup,
  field: string,
  envFallback?: string,
): Promise<{ value: string | null; source: CredentialResolved['source'] }> {
  const res = await getIntegrationCredentials(lookup, envFallback ? { [field]: envFallback } : undefined);
  return { value: res.credentials[field] ?? null, source: res.source };
}

/**
 * Org-level configured durumu — env VEYA DB'de credential varsa true.
 * Kullanıcı UI'dan kayıt yapınca env restart gerekmeden status güncellenir.
 */
export async function hasOrgCredentials(
  organizationId: string,
  integrationKey: string,
  envIsSet: boolean,
): Promise<boolean> {
  if (envIsSet) return true;
  const db = getDb();
  const [row] = await db
    .select({ id: integrationCredentials.id })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organization_id, organizationId),
        eq(integrationCredentials.integration_key, integrationKey),
        eq(integrationCredentials.is_active, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Birden fazla integration_key için tek sorguda configured map'i döner.
 * Performans için tercih edilir — N+1 önler.
 */
export async function getOrgConfiguredMap(
  organizationId: string,
  keys: string[],
  envMap: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = envMap[k] ?? false;
  if (keys.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({ integration_key: integrationCredentials.integration_key })
    .from(integrationCredentials)
    .where(
      and(
        eq(integrationCredentials.organization_id, organizationId),
        eq(integrationCredentials.is_active, true),
      ),
    );
  for (const r of rows) {
    if (out[r.integration_key] !== undefined) {
      out[r.integration_key] = true;
    }
  }
  return out;
}
