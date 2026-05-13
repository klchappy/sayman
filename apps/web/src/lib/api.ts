import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4300/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
});

// Subdomain'den org+tenant slug'larını oku, request'e header olarak ekle.
// Subdomain ile API'ye konuşma da çalışır ama lokal dev'de ana domain'den
// API'yi vurmak için bu header'lar fallback.
const host = window.location.hostname;
const parts = host.split('.');
if (parts.length >= 3) {
  api.defaults.headers.common['X-Sayman-Tenant'] = parts[0];
  api.defaults.headers.common['X-Sayman-Org'] = parts[1];
}
