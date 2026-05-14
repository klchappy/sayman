import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4300/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
});

/**
 * Active org/tenant accessor — auth store'a circular import yapmamak için
 * setter ile inject ediyoruz. App mount'unda useAuth'tan set edilir.
 */
let getActive: () => { orgSlug: string | null; tenantSlug: string | null } = () => ({
  orgSlug: null,
  tenantSlug: null,
});

export function bindActiveAccessor(fn: typeof getActive) {
  getActive = fn;
}

// Her request öncesi org/tenant header'ları güncelle
api.interceptors.request.use((config) => {
  const { orgSlug, tenantSlug } = getActive();

  if (orgSlug) {
    config.headers['X-Sayman-Org'] = orgSlug;
  } else {
    delete config.headers['X-Sayman-Org'];
  }
  if (tenantSlug) {
    config.headers['X-Sayman-Tenant'] = tenantSlug;
  } else {
    delete config.headers['X-Sayman-Tenant'];
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
