import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Home,
  Network,
  Receipt,
  Repeat,
  Search,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}
interface SearchCategory {
  category: string;
  label: string;
  icon: string;
  items: SearchResultItem[];
}
interface SearchResponse {
  query: string;
  results: SearchCategory[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UserCircle,
  Building2,
  Home,
  Receipt,
  Repeat,
  ShieldCheck,
  Network,
};

export function CommandPalette() {
  const navigate = useNavigate();
  const active = useAuth((s) => s.active);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K to toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const debouncedQ = useDebounce(query, 200);

  const searchQ = useQuery({
    queryKey: ['search', active.orgSlug, active.tenantSlug, debouncedQ],
    enabled: open && !!active.orgSlug && debouncedQ.length >= 2,
    queryFn: async () => {
      const res = await api.get<{ data: SearchResponse }>(
        `/search?q=${encodeURIComponent(debouncedQ)}`,
      );
      return res.data.data;
    },
  });

  // Flatten all items for keyboard navigation
  const flatItems: SearchResultItem[] = (searchQ.data?.results ?? []).flatMap((c) => c.items);

  useEffect(() => {
    setSelectedIdx(0);
  }, [debouncedQ]);

  useEffect(() => {
    function onArrow(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[selectedIdx];
        if (item) {
          navigate(item.url);
          setOpen(false);
        }
      }
    }
    window.addEventListener('keydown', onArrow);
    return () => window.removeEventListener('keydown', onArrow);
  }, [open, flatItems, selectedIdx, navigate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-100">
          <Search className="size-5 text-brand-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara: kullanıcı, şirket, fatura, teminat, ..."
            className="flex-1 outline-none text-base bg-transparent"
          />
          <kbd className="text-xs text-brand-400 font-mono px-2 py-1 bg-brand-50 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 && (
            <p className="p-6 text-center text-sm text-brand-400">
              En az 2 karakter yaz...
            </p>
          )}

          {query.length >= 2 && searchQ.isLoading && (
            <p className="p-6 text-center text-sm text-brand-500">Aranıyor...</p>
          )}

          {searchQ.data && searchQ.data.results.length === 0 && (
            <p className="p-6 text-center text-sm text-brand-500">
              "{query}" için sonuç yok.
            </p>
          )}

          {searchQ.data && searchQ.data.results.length > 0 && (() => {
            let globalIdx = 0;
            return (
              <div>
                {searchQ.data.results.map((cat) => {
                  const Icon = ICONS[cat.icon] ?? Search;
                  return (
                    <div key={cat.category}>
                      <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-brand-400 font-semibold">
                        {cat.label}
                      </p>
                      <ul>
                        {cat.items.map((item) => {
                          const myIdx = globalIdx++;
                          const isSelected = myIdx === selectedIdx;
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => {
                                  navigate(item.url);
                                  setOpen(false);
                                }}
                                onMouseEnter={() => setSelectedIdx(myIdx)}
                                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${
                                  isSelected ? 'bg-brand-50' : ''
                                }`}
                              >
                                <Icon className="size-4 text-brand-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-brand-900 truncate">
                                    {item.title}
                                  </p>
                                  {item.subtitle && (
                                    <p className="text-xs text-brand-500 truncate">{item.subtitle}</p>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-brand-100 flex items-center justify-between text-xs text-brand-400">
          <span>↑↓ gezin · Enter aç · ESC kapat</span>
          <span className="font-mono">Ctrl/⌘ + K</span>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
