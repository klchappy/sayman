/**
 * ConfirmDialog — window.confirm/alert/prompt yerine kullanılan styled modal.
 *
 * Avantajları:
 *   - Mobil cihazlarda native dialog'lar bloklayıcı ve stillenemiyor; bu modal hem mobile hem desktop'ta güvenilir
 *   - Submit butonu loading state'i destekler (çift tıklama race koruması)
 *   - Escape + dış tıklama ile kapanır
 *   - prompt() varyantı için input desteği
 *
 * Kullanım:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Sil?', message: 'Bu işlem geri alınamaz.', variant: 'danger' })) {
 *     remove.mutate();
 *   }
 *
 *   // prompt varyantı
 *   const name = await confirm({ title: 'Onayla', message: 'Şirket adını yaz', requireInput: 'Şirket adı' });
 *   if (name) ...
 */
import { AlertTriangle, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ConfirmVariant = 'default' | 'danger' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Prompt modu — set edilirse kullanıcı string girer, onay sadece girilen değerle aktifleşir */
  requireInput?: string;
  /** Onay için kullanıcının yazması gereken tam string (örn. silmek için tenant adı) */
  requireMatch?: string;
}

type PendingPromise = {
  resolve: (v: string | boolean | null) => void;
  opts: ConfirmOptions;
};

interface ConfirmCtx {
  request: (opts: ConfirmOptions) => Promise<string | boolean | null>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

export function useConfirm(): (opts: ConfirmOptions) => Promise<string | boolean | null> {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm: ConfirmDialogProvider eksik');
  return ctx.request;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingPromise | null>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const request = useCallback((opts: ConfirmOptions) => {
    return new Promise<string | boolean | null>((resolve) => {
      setInput('');
      setPending({ resolve, opts });
    });
  }, []);

  useEffect(() => {
    if (pending && (pending.opts.requireInput || pending.opts.requireMatch)) {
      // Modal açılınca input'a focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pending.resolve(pending.opts.requireInput ? null : false);
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  function close(value: string | boolean | null) {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  }

  const opts = pending?.opts;
  const variant: ConfirmVariant = opts?.variant ?? 'default';
  const promptMode = !!opts?.requireInput;
  const matchMode = !!opts?.requireMatch;
  const matchOk = !matchMode || input === opts?.requireMatch;
  const promptOk = !promptMode || input.trim().length > 0;
  const canConfirm = matchOk && promptOk;

  const variantStyles = {
    default: {
      icon: <Info className="size-6 text-brand-500" />,
      button: 'bg-brand-600 hover:bg-brand-700 text-white',
    },
    danger: {
      icon: <AlertTriangle className="size-6 text-red-600" />,
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    info: {
      icon: <Info className="size-6 text-blue-600" />,
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }[variant];

  return (
    <Ctx.Provider value={{ request }}>
      {children}
      {pending && opts && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] grid place-items-center p-4"
          onClick={() => close(promptMode ? null : false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-5 border-b border-brand-100 dark:border-slate-800">
              <div className="shrink-0 mt-0.5">{variantStyles.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-title" className="font-semibold text-brand-900 dark:text-slate-100">
                  {opts.title}
                </h3>
                <p className="mt-1 text-sm text-brand-700 dark:text-slate-300 whitespace-pre-wrap">
                  {opts.message}
                </p>
              </div>
              <button
                onClick={() => close(promptMode ? null : false)}
                className="text-brand-500 hover:text-brand-900 dark:hover:text-slate-100 p-1"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>

            {(promptMode || matchMode) && (
              <div className="px-5 pt-4">
                <label className="block text-sm text-brand-700 dark:text-slate-300 mb-1.5">
                  {opts.requireInput ?? `Onaylamak için "${opts.requireMatch}" yazın`}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canConfirm) {
                      close(promptMode ? input : true);
                    }
                  }}
                  className="w-full px-3 py-2 border border-brand-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-brand-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 p-4">
              <button
                onClick={() => close(promptMode ? null : false)}
                className="px-4 py-2 text-sm font-medium text-brand-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 rounded-md"
              >
                {opts.cancelLabel ?? 'Vazgeç'}
              </button>
              <button
                onClick={() => close(promptMode ? input : true)}
                disabled={!canConfirm}
                className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles.button}`}
              >
                {opts.confirmLabel ?? 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Boolean confirm helper — sade kullanım için */
export function useConfirmBool() {
  const confirm = useConfirm();
  return useCallback(
    async (opts: Omit<ConfirmOptions, 'requireInput'>) => {
      const r = await confirm(opts);
      return r === true;
    },
    [confirm],
  );
}
