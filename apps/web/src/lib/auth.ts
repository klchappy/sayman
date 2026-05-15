/**
 * Auth + active tenant store — Hibrit Supabase + Local Auth.
 *
 * Strategy:
 *   - Supabase env varsa → Supabase session
 *   - Supabase env yoksa → POST /auth/local/sign-in + localStorage token
 *   - me her iki modda da /v1/me'den gelir (orgs + tenant_overrides)
 *
 * activeOrg + activeTenant: kullanıcının hangi organization ve tenant'ta
 * çalıştığını tutar. Axios her request öncesi bu değerleri header'a yapıştırır.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

// Supabase Auth path tamamen kaldırıldı (15 Mayıs 2026). Sadece local auth kullanılır.
// session field geriye dönük uyumluluk için kaldı (her zaman null).
type Session = null;

const LOCAL_TOKEN_KEY = 'sayman-local-token';

export interface MeOrganization {
  id: string;
  slug: string;
  name: string;
  plan: string;
  role: string;
}

export interface MeTenantOverride {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  organization_id: string;
  value: string;
}

export interface MeData {
  user: {
    id: string;
    email: string;
    username: string | null;
    full_name: string;
    avatar_url: string | null;
  };
  organizations: MeOrganization[];
  tenant_overrides: MeTenantOverride[];
}

export interface ActiveSelection {
  orgSlug: string | null;
  tenantSlug: string | null;
  /**
   * Aggregate mode: admin org-level rolü ile tüm tenant'ların verisini birleşik görür.
   * - aggregate=true + tenantSlug=null → org-wide read
   * - Liste/dashboard/raporlar API'ye X-Sayman-Aggregate:1 header'ı ile çağrılır
   * - Mutation endpoint'leri tenant zorunlu — aggregate mode'da blocked
   */
  aggregate: boolean;
}

interface AuthState {
  session: Session | null;
  /** Local auth modunda kullanılır — Supabase modunda undefined. */
  localToken: string | null;
  me: MeData | null;
  active: ActiveSelection;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setActive: (a: Partial<ActiveSelection>) => void;
  /** true ise kullanıcı aktif org'da super_admin / organization_admin / yonetici rolüne sahip */
  isAdmin: () => boolean;
}

function applyToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      localToken: null,
      me: null,
      active: { orgSlug: null, tenantSlug: null, aggregate: false },
      loading: false,
      initialized: false,

      async init() {
        // Tek auth: local. Supabase Auth path kaldırıldı.
        const storedLocal = localStorage.getItem(LOCAL_TOKEN_KEY);
        if (storedLocal) {
          applyToken(storedLocal);
          set({ localToken: storedLocal });
          try {
            await get().refreshMe();
            set({ initialized: true });
            return;
          } catch {
            localStorage.removeItem(LOCAL_TOKEN_KEY);
            applyToken(null);
            set({ localToken: null });
          }
        }
        set({ initialized: true });
      },

      async signIn(email, password) {
        set({ loading: true });
        try {
          // Tek auth path: local. Supabase Auth artık kullanılmıyor —
          // hibrit yapı kafa karışıklığı yaratıyordu (iki ayrı şifre store).
          const res = await api.post<{ access_token: string }>('/auth/local/sign-in', {
            identifier: email,
            password,
          });
          const token = res.data.access_token;
          localStorage.setItem(LOCAL_TOKEN_KEY, token);
          applyToken(token);
          set({ localToken: token, session: null });
          await get().refreshMe();
        } finally {
          set({ loading: false });
        }
      },

      async signOut() {
        const { localToken } = get();
        if (localToken) {
          try {
            await api.post('/auth/logout');
          } catch {
            // backend down → ignore
          }
          localStorage.removeItem(LOCAL_TOKEN_KEY);
        }
        // Eski Supabase session'ları temizle (legacy cleanup — varsa)
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('sb-'))
            .forEach((k) => localStorage.removeItem(k));
        } catch {}
        applyToken(null);
        set({
          session: null,
          localToken: null,
          me: null,
          active: { orgSlug: null, tenantSlug: null, aggregate: false },
        });
      },

      async refreshMe() {
        const res = await api.get<{ data: MeData }>('/me');
        const me = res.data.data;
        set({ me });

        // İlk login: default org seç (varsa); tenant seçilmemiş kalsın
        const current = get().active;
        if (!current.orgSlug && me.organizations.length > 0) {
          const firstOrg = me.organizations[0];
          if (firstOrg) {
            set({ active: { orgSlug: firstOrg.slug, tenantSlug: null, aggregate: false } });
          }
        }
      },

      isAdmin() {
        const me = get().me;
        const orgSlug = get().active.orgSlug;
        if (!me || !orgSlug) return false;
        const role = me.organizations.find((o) => o.slug === orgSlug)?.role;
        return ['super_admin', 'organization_admin', 'yonetici'].includes(role ?? '');
      },

      setActive(a) {
        set({ active: { ...get().active, ...a } });
      },
    }),
    {
      name: 'sayman-active',
      partialize: (s) => ({ active: s.active }),
      // Eski persist'lerde active.aggregate yoktu — undefined'ı false yap
      version: 2,
      migrate: (persisted: unknown, _version: number) => {
        const p = persisted as { active?: Partial<ActiveSelection> } | undefined;
        if (p?.active) {
          return {
            active: {
              orgSlug: p.active.orgSlug ?? null,
              tenantSlug: p.active.tenantSlug ?? null,
              aggregate: p.active.aggregate ?? false,
            },
          };
        }
        return { active: { orgSlug: null, tenantSlug: null, aggregate: false } };
      },
    },
  ),
);
