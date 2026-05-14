import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Clock,
  Home,
  Network,
  Receipt,
  Repeat,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Zap,
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
  rank?: number;
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
  ms: number;
}

interface RecentItem {
  query: string;
  last_used: string;
  result_count: number;
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

/** Eşleşen substring'i bold yapar. */
function highlight(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const lower = text.toLowerCase();
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return text;

  // İlk eşleşen token'ı bul
  let matchStart = -1;
  let matchLen = 0;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx >= 0) {
      matchStart = idx;
      matchLen = t.length;
      break;
    }
  }
  if (matchStart < 0) return text;
  return (
    <>
      {text.slice(0, matchStart)}
      <mark className="bg-amber-100 text-brand-900 px-0.5 rounded">
        {text.slice(matchStart, matchStart + matchLen)}
      </mark>
      {text.slice(matchStart + matchLen)}
    </>
  );
}

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

  // Recent searches (boş input'ta gösterilir)
  const recentQ = useQuery({
    queryKey: ['search-recent'],
    enabled: open && query.length === 0,
    queryFn: async () => {
      const res = await api.get<{ data: RecentItem[] }>('/search/recent');
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
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden ring-1 ring-black/5"
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
            className="flex-1 outline-none text-base bg-transparent placeholder:text-brand-300"
          />
          {searchQ.data && (
            <span className="text-[10px] font-mono text-brand-400 flex items-center gap-1">
              <Zap className="size-3" />
              {searchQ.data.ms}ms
            </span>
          )}
          <kbd className="text-xs text-brand-400 font-mono px-2 py-1 bg-brand-50 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {/* Boş state — son aramalar */}
          {query.length === 0 && (
            <div>
              {recentQ.data && recentQ.data.length > 0 ? (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-brand-400 font-semibold flex items-center gap-1">
                    <Clock className="size-3" />
                    Son Aramaların
                  </p>
                  <ul>
                    {recentQ.data.slice(0, 7).map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => setQuery(r.query)}
                          className="w-full text-left px-4 py-2 hover:bg-brand-50 text-sm text-brand-700 flex items-center justify-between"
                        >
                          <span>{r.query}</span>
                          <span className="text-xs text-brand-400">
                            {r.result_count > 0 ? `${r.result_count} sonuç` : 'sonuç yok'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="p-6 text-center text-sm text-brand-400">
                  <Search className="size-8 mx-auto mb-2 text-brand-200" />
                  <p>En az 2 karakter yaz...</p>
                </div>
              )}
            </div>
          )}

          {query.length === 1 && (
            <p className="p-6 text-center text-sm text-brand-400">
              En az 2 karakter yaz...
            </p>
          )}

          {query.length >= 2 && searchQ.isLoading && (
            <div className="p-6 text-center text-sm text-brand-500 flex items-center justify-center gap-2">
              <div className="size-3 rounded-full bg-brand-400 animate-pulse"></div>
              Aranıyor...
            </div>
          )}

          {searchQ.data && searchQ.data.results.length === 0 && (
            <p className="p-6 text-center text-sm text-brand-500">
              "<strong>{query}</strong>" için sonuç yok.
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
                      <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-brand-400 font-semibold flex items-center gap-1">
                        {cat.label}
                        <span className="text-brand-300">·</span>
                        <span className="text-brand-300">{cat.items.length}</span>
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
                                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                                  isSelected ? 'bg-brand-50' : 'hover:bg-brand-50/50'
                                }`}
                              >
                                <Icon className="size-4 text-brand-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-brand-900 truncate">
                                    {highlight(item.title, query)}
                                  </p>
                                  {item.subtitle && (
                                    <p className="text-xs text-brand-500 truncate">
                                      {highlight(item.subtitle, query)}
                                    </p>
                                  )}
                                </div>
                                {item.rank !== undefined && item.rank > 0 && (
                                  <span className="text-[9px] font-mono text-brand-300">
                                    {item.rank.toFixed(2)}
                                  </span>
                                )}
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
          <span className="flex items-center gap-3">
            <span>↑↓ gezin</span>
            <span>Enter aç</span>
            <span>ESC kapat</span>
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            <span className="font-mono">PostgreSQL FTS · Ctrl/⌘ + K</span>
          </span>
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
