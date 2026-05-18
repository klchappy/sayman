/**
 * EmptyState - liste sayfaları için akıllı boş durum komponenti.
 */
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  entityLabel: string;
  hasActiveFilter?: boolean;
  onClearFilter?: () => void;
  clearFilterLabel?: string;
  filterDescription?: string;
  customMessage?: string;
  customCTA?: ReactNode;
}

export function EmptyState({
  icon,
  entityLabel,
  hasActiveFilter = false,
  onClearFilter,
  clearFilterLabel = 'Filtreyi temizle ↻',
  filterDescription,
  customMessage,
  customCTA,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="mx-auto mb-3 flex justify-center">{icon}</div>}

      {hasActiveFilter ? (
        <>
          <p className="text-brand-700 dark:text-slate-300 font-medium mb-1">
            Eşleşen {entityLabel} bulunamadı
          </p>
          <p className="text-xs text-brand-500 dark:text-slate-400 mb-4">
            {filterDescription ?? 'Aktif filtreyle eşleşen kayıt yok.'}
          </p>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="text-sm text-brand-700 dark:text-slate-300 underline hover:no-underline"
            >
              {clearFilterLabel}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-brand-700 dark:text-slate-300 font-medium">
            {customMessage ?? `Henüz ${entityLabel} eklenmemiş.`}
          </p>
          {customCTA && <div className="mt-3">{customCTA}</div>}
        </>
      )}
    </div>
  );
}
