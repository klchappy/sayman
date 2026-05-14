import { Keyboard, X } from 'lucide-react';
import { SHORTCUTS_LIST, useKeyboardShortcuts } from '../lib/useKeyboardShortcuts';

export function ShortcutsHelp() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  if (!showHelp) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brand-900 flex items-center gap-2">
            <Keyboard className="size-5" />
            Klavye Kısayolları
          </h2>
          <button
            onClick={() => setShowHelp(false)}
            className="text-brand-500 hover:text-brand-900"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS_LIST.map((s) => (
            <li key={s.keys.join('-')} className="flex items-center justify-between gap-3">
              <span className="text-sm text-brand-800">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="bg-brand-50 border border-brand-200 rounded px-2 py-0.5 text-xs font-mono text-brand-700"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-brand-400 mt-4 border-t border-brand-100 pt-3">
          <kbd className="font-mono">g</kbd> kombinasyonu için ilk tuşa bas, sonra 1 saniye içinde
          ikinci tuşa bas.
        </p>
      </div>
    </div>
  );
}
