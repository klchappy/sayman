/**
 * Local auth token storage — Supabase'den bağımsız.
 *
 * Local JWT (sign-up-org / sign-in / reset-password sonrası) bu storage'da
 * tutulur. axios interceptor öncelikli olarak bu token'ı kullanır.
 */
const TOKEN_KEY = 'sayman_local_token';

export function getLocalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLocalToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearLocalToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
