import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const label =
    theme === 'light' ? 'Açık tema' : theme === 'dark' ? 'Koyu tema' : 'Sistem temasını takip et';

  return (
    <button
      onClick={cycle}
      title={label}
      aria-label={label}
      className="p-2 text-brand-500 hover:text-brand-900 hover:bg-brand-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
    >
      {theme === 'light' && <Sun className="size-4" />}
      {theme === 'dark' && <Moon className="size-4" />}
      {theme === 'system' && <Monitor className="size-4" />}
    </button>
  );
}
