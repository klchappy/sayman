/**
 * Auth + active tenant store — Supabase session + organization/tenant seçimi.
 *
 * activeOrg + activeTenant: kullanıcının hangi organization ve tenant'ta
 * çalıştığını tutar. Axios interceptor her request öncesi bu değerleri
 * X-Sayman-Org / X-Sayman-Tenant header'larına yapıştırır.
 */
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';
import { getSupabase, isSupabaseConfigured } from './supabase';

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
}

interface AuthState {
  session: Session | null;
  me: MeData | null;
  active: ActiveSelection;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setActive: (a: Partial<ActiveSelection>) => void;
}

function applyToken(session: Session | null) {
  if (session?.access_token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      me: null,
      active: { orgSlug: null, tenantSlug: null },
      loading: false,
      initialized: false,

      async init() {
        if (!isSupabaseConfigured) {
          set({ initialized: true });
          return;
        }
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        applyToken(data.session);
        set({ session: data.session });

        supabase.auth.onAuthStateChange((_event, session) => {
          applyToken(session);
          set({ session });
          if (!session) set({ me: null, active: { orgSlug: null, tenantSlug: null } });
        });

        if (data.session) {
          try {
            await get().refreshMe();
          } catch {
            // /v1/me 404 → public.users profili eksik
          }
        }
        set({ initialized: true });
      },

      async signIn(email, password) {
        set({ loading: true });
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          applyToken(data.session);
          set({ session: data.session });
          await get().refreshMe();
        } finally {
          set({ loading: false });
        }
      },

      async signOut() {
        if (isSupabaseConfigured) {
          const supabase = getSupabase();
          await supabase.auth.signOut();
        }
        applyToken(null);
        set({ session: null, me: null, active: { orgSlug: null, tenantSlug: null } });
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
            set({ active: { orgSlug: firstOrg.slug, tenantSlug: null } });
          }
        }
      },

      setActive(a) {
        set({ active: { ...get().active, ...a } });
      },
    }),
    {
      name: 'sayman-active',
      partialize: (s) => ({ active: s.active }),
    },
  ),
);
