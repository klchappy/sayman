/**
 * AuditHistoryButton — bir kayıt için "Geçmiş" dialog'u açar.
 * GET /security/audit/record?target_table=...&target_id=... çağrısı yapılır.
 *
 * Olaylar kronolojik (en yeni en üstte) listelenir:
 *   - kim (actor_email veya 'sistem')
 *   - ne (action label)
 *   - değişen alanlar (after_data içindeki anahtarlar)
 *   - ne zaman
 */
import { useQuery } from '@tanstack/react-query';
import { History, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';

interface AuditRow {
  id: string;
  action: string;
  module: string | null;
  target_table: string | null;
  target_id: string | null;
  actor_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export function AuditHistoryButton({
  targetTable,
  targetId,
  label = 'Geçmiş',
  compact = true,
}: {
  targetTable: string;
  targetId: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        title="Bu kayıt için tüm olayları gör (kim, ne, ne zaman)"
        className={
          compact
            ? 'text-[9px] bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1'
            : 'text-xs border border-brand-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-slate-800 text-brand-700 dark:text-slate-300 px-3 py-1.5 rounded inline-flex items-center gap-1'
        }
      >
        <History className={compact ? 'size-2.5' : 'size-3'} />
        {label}
      </button>
      {open && (
        <AuditHistoryDialog
          targetTable={targetTable}
          targetId={targetId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AuditHistoryDialog({
  targetTable,
  targetId,
  onClose,
}: {
  targetTable: string;
  targetId: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ['audit-record', targetTable, targetId],
    queryFn: async () => {
      const res = await api.get<{ data: AuditRow[] }>(
        `/security/audit/record?target_table=${encodeURIComponent(targetTable)}&target_id=${encodeURIComponent(targetId)}`,
      );
      return res.data.data;
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-brand-100 dark:border-slate-700">
          <div>
            <h3 className="font-semibold text-brand-900 dark:text-slate-100 flex items-center gap-2">
              <History className="size-5" />
              Kayıt Geçmişi
            </h3>
            <p className="text-xs text-brand-500 dark:text-slate-400 mt-1">
              {targetTable} · {targetId.slice(0, 8)}…
            </p>
          </div>
          <button onClick={onClose} className="text-brand-500 hover:text-brand-900">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {q.isLoading && <p className="text-sm text-brand-500">Yükleniyor…</p>}
          {q.data && q.data.length === 0 && (
            <p className="text-sm text-brand-500 dark:text-slate-400 text-center py-8">
              Bu kayıt için log girdisi bulunamadı.
            </p>
          )}
          <ul className="space-y-3">
            {q.data?.map((row) => {
              const after = (row.after_data ?? {}) as Record<string, unknown>;
              const label = String(after.action_label ?? row.action);
              const actor = String(after.actor_email ?? row.actor_id ?? 'sistem');
              const details = Object.fromEntries(
                Object.entries(after).filter(([k]) => k !== 'action_label' && k !== 'actor_email'),
              );
              return (
                <li
                  key={row.id}
                  className="border-l-2 border-brand-300 dark:border-slate-600 pl-4 pb-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-brand-900 dark:text-slate-100">
                      {label}
                    </p>
                    <span className="text-[10px] text-brand-400">
                      {new Date(row.created_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p className="text-xs text-brand-600 dark:text-slate-400 mt-1">
                    Kim: <span className="font-mono">{actor}</span>
                    {row.ip_address && <> · IP: {row.ip_address}</>}
                  </p>
                  {Object.keys(details).length > 0 && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-brand-500 cursor-pointer hover:text-brand-700">
                        Detaylar
                      </summary>
                      <pre className="text-[10px] mt-1 bg-brand-50 dark:bg-slate-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
