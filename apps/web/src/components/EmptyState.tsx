/**
 * EmptyState — Liste sayfaları için akıllı boş durum komponenti.
 *
 * Sorun: Liste boşken kullanıcı bunun *neden* boş olduğunu bilmiyordu.
 * - Tenant'ta hiç kayıt yok mu?
 * - Aktif bir filtre eşleşeni yok mu?
 * - Arama metni hiçbir kayda uymadı mı?
 * - Otomatik yaratılmış kayıtlar onay bekliyor mu? (PendingReviewEmptyHint)
 *
 * Bu komponent durumu otomatik anlar ve uygun mesajı + CTA'yı gösterir.
 *
 * Kullanım:
 *   <EmptyState
 *     icon={<Coins className="size-12 text-brand-300" />}
 *     entityLabel="fatura"
 *     hasActiveFilter={!!search || status !== 'all'}
 *     onClearFilter={() => { setSearch(''); setStatus('all'); }}
 *   />
 */
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  entityLabel: string;
  hasActiveFilter?: boolean;
  onClearFilter?: () => void;
  filterDescription?: string;
  customMessage?: string;
  customCTA?: ReactNode;
}

export function EmptyState({
  icon,
  entityLabel,
  hasActiveFilter = false,
  onClearFilter,
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
              Filtreyi temizle ↻
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
