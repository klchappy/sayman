/**
 * Tema yönetimi — light | dark | system.
 *
 * - system: media query prefers-color-scheme'i takip et
 * - localStorage'a yazılır: 'sayman.theme'
 * - html.classList'e 'dark' eklenir/çıkarılır
 */
import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  init: () => void;
}

const STORAGE_KEY = 'sayman.theme';

function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: (t) => {
    localStorage.setItem(STORAGE_KEY, t);
    const resolved = resolveTheme(t);
    applyTheme(resolved);
    set({ theme: t, resolvedTheme: resolved });
  },
  init: () => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
    const resolved = resolveTheme(stored);
    applyTheme(resolved);
    set({ theme: stored, resolvedTheme: resolved });

    // System rengi değişirse takip et (sadece system modundayken)
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (get().theme === 'system') {
        const newResolved = mq.matches ? 'dark' : 'light';
        applyTheme(newResolved);
        set({ resolvedTheme: newResolved });
      }
    });
  },
}));
