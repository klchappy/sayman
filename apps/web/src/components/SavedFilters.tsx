/**
 * SavedFilters — kullanıcının module bazlı kayıtlı filtrelerini gösterir.
 *
 * Kullanım: <SavedFilters module="payables" currentFilters={...} onApply={(f) => setFilters(f)} />
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkPlus, ChevronDown, Pin, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useConfirmBool } from './ConfirmDialog';

interface SavedSearch {
  id: string;
  module: string;
  name: string;
  filters: Record<string, unknown>;
  is_pinned: boolean;
  created_at: string;
}

export function SavedFilters({
  module,
  currentFilters,
  onApply,
}: {
  module: string;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const qc = useQueryClient();
  const confirmBool = useConfirmBool();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const list = useQuery({
    queryKey: ['saved-searches', module],
    queryFn: async () => {
      const res = await api.get<{ data: SavedSearch[] }>(
        `/saved-searches?module=${module}`,
      );
      return res.data.data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      await api.post('/saved-searches', {
        module,
        name,
        filters: currentFilters,
        is_pinned: isPinned,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-searches', module] });
      setSaving(false);
      setName('');
      setIsPinned(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/saved-searches/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches', module] }),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1"
      >
        <Bookmark className="size-3" />
        Kayıtlı Filtreler
        {list.data && list.data.length > 0 && (
          <span className="bg-brand-200 dark:bg-slate-700 text-brand-700 dark:text-slate-300 text-[10px] px-1.5 rounded">
            {list.data.length}
          </span>
        )}
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 right-0 w-72 bg-white dark:bg-slate-900 border border-brand-200 dark:border-slate-700 rounded-lg shadow-lg p-2">
          <div className="flex items-center justify-between mb-2 px-2 py-1">
            <span className="text-xs uppercase tracking-wide text-brand-500">
              Filtrelerim
            </span>
            <button
              onClick={() => setSaving(!saving)}
              className="text-xs text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1"
            >
              <BookmarkPlus className="size-3" />
              Mevcut filtreyi kaydet
            </button>
          </div>

          {saving && (
            <div className="border-t border-brand-100 dark:border-slate-800 pt-2 mb-2 px-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Filtre adı..."
                className="w-full rounded border border-brand-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1 text-xs"
              />
              <label className="flex items-center gap-1 text-[10px] text-brand-500 mt-1">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <Pin className="size-3" />
                Sayfa açılışında otomatik uygula
              </label>
              <div className="flex justify-end gap-1 mt-2">
                <button
                  onClick={() => setSaving(false)}
                  className="text-xs text-brand-500 hover:text-brand-900 px-2 py-0.5"
                >
                  İptal
                </button>
                <button
                  onClick={() => name.length >= 2 && save.mutate()}
                  disabled={name.length < 2 || save.isPending}
                  className="text-xs bg-brand-900 text-white px-2 py-0.5 rounded disabled:opacity-50"
                >
                  Kaydet
                </button>
              </div>
            </div>
          )}

          {list.data && list.data.length === 0 && !saving && (
            <p className="text-xs text-brand-400 px-2 py-2 italic">
              Henüz kayıtlı filtre yok. Filtreni uygula ve "kaydet" tıkla.
            </p>
          )}

          {list.data && list.data.length > 0 && (
            <ul className="max-h-72 overflow-y-auto">
              {list.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-brand-50 dark:hover:bg-slate-800 group"
                >
                  <button
                    onClick={() => {
                      onApply(s.filters);
                      setOpen(false);
                    }}
                    className="flex-1 text-left text-sm flex items-center gap-1"
                  >
                    {s.is_pinned && <Pin className="size-3 text-amber-600" />}
                    {s.name}
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirmBool({ title: 'Filtreyi sil', message: `"${s.name}" silinsin mi?`, variant: 'danger', confirmLabel: 'Sil' })) {
                        remove.mutate(s.id);
                      }
                    }}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
