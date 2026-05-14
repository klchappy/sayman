/**
 * Auth store — Supabase session yönetimi.
 *
 * Damga pattern'i: zustand store, mount edildiğinde Supabase session'ı yükler;
 * onAuthStateChange ile token refresh'i izler.
 */
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { api } from './api';
import { getSupabase, isSupabaseConfigured } from './supabase';

interface MeOrganization {
  id: string;
  slug: string;
  name: string;
  plan: string;
  role: string;
}

interface MeData {
  user: { id: string; email: string; username: string | null; full_name: string; avatar_url: string | null };
  organizations: MeOrganization[];
  tenant_overrides: Array<{
    tenant_id: string;
    tenant_slug: string;
    tenant_name: string;
    organization_id: string;
    value: string;
  }>;
}

interface AuthState {
  session: Session | null;
  me: MeData | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

function applyToken(session: Session | null) {
  if (session?.access_token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  me: null,
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
      if (!session) set({ me: null });
    });

    if (data.session) {
      try {
        await get().refreshMe();
      } catch {
        // /v1/me 404 → public.users profili eksik (sign-up tamamlanmamış)
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
    set({ session: null, me: null });
  },

  async refreshMe() {
    const res = await api.get<{ data: MeData }>('/me');
    set({ me: res.data.data });
  },
}));
