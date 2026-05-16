import axios from 'axios';
import { getLocalToken } from './local-auth';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4300/v1';

export const apiBaseURL = baseURL;
export function getApiBaseUrl(): string {
  return baseURL;
}

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
});

/**
 * Local token (sign-up-org / reset-password) varsa onu öncelikle kullan.
 * Yoksa Supabase Authorization header'ı (auth.ts'de set edilir) kalır.
 */
api.interceptors.request.use((config) => {
  const localToken = getLocalToken();
  if (localToken) {
    config.headers['Authorization'] = `Bearer ${localToken}`;
  }
  return config;
});

/**
 * Active org/tenant accessor — auth store'a circular import yapmamak için
 * setter ile inject ediyoruz. App mount'unda useAuth'tan set edilir.
 *
 * `aggregate=true` admin'lerin org-wide read modu için. Bu mode'da
 * tenantSlug null gönderilir + X-Sayman-Aggregate: 1 header eklenir.
 */
let getActive: () => {
  orgSlug: string | null;
  tenantSlug: string | null;
  aggregate?: boolean;
} = () => ({
  orgSlug: null,
  tenantSlug: null,
});

export function bindActiveAccessor(fn: typeof getActive) {
  getActive = fn;
}

// Her request öncesi org/tenant header'ları güncelle
api.interceptors.request.use((config) => {
  const { orgSlug, tenantSlug, aggregate } = getActive();

  if (orgSlug) {
    config.headers['X-Sayman-Org'] = orgSlug;
  } else {
    delete config.headers['X-Sayman-Org'];
  }
  if (tenantSlug && !aggregate) {
    config.headers['X-Sayman-Tenant'] = tenantSlug;
  } else {
    delete config.headers['X-Sayman-Tenant'];
  }
  if (aggregate) {
    config.headers['X-Sayman-Aggregate'] = '1';
  } else {
    delete config.headers['X-Sayman-Aggregate'];
  }

  // Aggregate mode'da mutation engelleme: tenant context'i yok, hangi tenant'a
  // yazılacağı belirsiz. Kullanıcı önce şirket seçmeli.
  if (
    aggregate &&
    config.method &&
    ['post', 'patch', 'put', 'delete'].includes(config.method.toLowerCase())
  ) {
    const allowList = ['/auth/', '/users/me', '/support/', '/notifications/'];
    const url = config.url ?? '';
    if (!allowList.some((p) => url.includes(p))) {
      return Promise.reject(
        new Error(
          '"Tüm Şirketler" modunda işlem yapılamaz — önce sağ üstten bir şirket seç.',
        ),
      );
    }
  }
  return config;
});

// Subdomain'den de default seçim (fallback)
const host = window.location.hostname;
const parts = host.split('.');
if (parts.length >= 3) {
  // {tenant}.{org}.host pattern (lokal dev'de)
  const subdomainOrg = parts[1];
  const subdomainTenant = parts[0];
  getActive = () => ({ orgSlug: subdomainOrg ?? null, tenantSlug: subdomainTenant ?? null });
}
