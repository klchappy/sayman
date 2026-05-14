/**
 * Heavy user için global klavye kısayolları.
 *
 * Şortcuts:
 *   g + d   → Dashboard
 *   g + i   → Inbox
 *   g + p   → Payables
 *   g + s   → Suppliers
 *   g + f   → Forecast
 *   g + t   → Tasks
 *   g + a   → AI Assistant
 *   n       → New payable (PayableForm aç)
 *   ?       → Klavye kısayolları yardım modalı
 *   esc     → Modal/dialog kapat
 *
 * G prefix bir buffer'da tutulur, 1 sn içinde devam edilmesse temizlenir.
 * Inputs/textareas aktifken devre dışı kalır (yazma engellenmesin).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PATH_MAP: Record<string, string> = {
  d: '/',
  i: '/inbox',
  p: '/payables',
  s: '/suppliers',
  f: '/forecast',
  t: '/tasks',
  a: '/ai',
  n: '/notifications',
  o: '/orgs',
  u: '/users',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let gBuffer: ReturnType<typeof setTimeout> | null = null;
    let gActive = false;

    function isTypingInInput(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (el as HTMLElement).isContentEditable
      );
    }

    function handler(e: KeyboardEvent) {
      // Cmd/Ctrl + K command palette zaten var, dokunma
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return;
      // Cmd/Ctrl tek başına modifier — pass
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isTypingInInput()) return;

      const k = e.key.toLowerCase();

      if (k === '?') {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
      if (k === 'escape') {
        setShowHelp(false);
        return;
      }

      if (k === 'g') {
        e.preventDefault();
        gActive = true;
        if (gBuffer) clearTimeout(gBuffer);
        gBuffer = setTimeout(() => {
          gActive = false;
        }, 1000);
        return;
      }

      if (gActive) {
        if (PATH_MAP[k]) {
          e.preventDefault();
          navigate(PATH_MAP[k]);
        }
        gActive = false;
        if (gBuffer) clearTimeout(gBuffer);
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gBuffer) clearTimeout(gBuffer);
    };
  }, [navigate]);

  return { showHelp, setShowHelp };
}

export const SHORTCUTS_LIST = [
  { keys: ['g', 'd'], label: 'Dashboard' },
  { keys: ['g', 'i'], label: 'Inbox' },
  { keys: ['g', 'p'], label: 'Faturalar' },
  { keys: ['g', 's'], label: 'Tedarikçiler' },
  { keys: ['g', 'f'], label: 'Nakit Tahmin' },
  { keys: ['g', 't'], label: 'Görevler' },
  { keys: ['g', 'a'], label: 'AI Asistan' },
  { keys: ['g', 'n'], label: 'Bildirimler' },
  { keys: ['Ctrl', 'K'], label: 'Hızlı Ara' },
  { keys: ['?'], label: 'Bu yardımı göster' },
];
