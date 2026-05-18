/**
 * PendingReviewBanner — Smart-import / OCR / e-fatura ile otomatik yaratılmış
 * ve henüz onaylanmamış kayıtların görünürlüğünü sağlar.
 *
 * Sorun: payable_items, sales_invoices, companies, persons tablolarında
 * `needs_review=true` flag'i olan kayıtlar normal listede gizleniyor, kullanıcı
 * "fatura kayboldu" sanıyor. Çözüm: Liste sayfalarının üstünde net banner.
 *
 * Kullanım:
 *   <PendingReviewBanner type="payables" />
 *   <PendingReviewBanner type="sales_invoices" />
 *   <PendingReviewBanner type="companies" />
 *   <PendingReviewBanner type="persons" />
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type ReviewType = 'payables' | 'sales_invoices' | 'companies' | 'persons';

interface ReviewSummary {
  companies: number;
  persons: number;
  payables: number;
  sales_invoices: number;
  total: number;
}

const TYPE_CONFIG: Record<
  ReviewType,
  { entity: string; verb: string; reviewType: string; icon: string }
> = {
  payables: { entity: 'fatura', verb: 'onay bekliyor', reviewType: 'payable', icon: '📋' },
  sales_invoices: {
    entity: 'satış faturası',
    verb: 'onay bekliyor',
    reviewType: 'sales_invoice',
    icon: '🧾',
  },
  companies: { entity: 'cari', verb: 'doğrulama bekliyor', reviewType: 'company', icon: '🏢' },
  persons: { entity: 'kişi', verb: 'doğrulama bekliyor', reviewType: 'person', icon: '👤' },
};

/**
 * Tek shared hook — banner, dashboard widget, empty hint, sidebar badge
 * hepsi aynı queryKey'i kullansın ki:
 *   - 30s'de 4 ayrı /review-queue/summary call yapılmasın (eskiden 4 farklı
 *     queryKey root: -banner, -shell, -empty + sidebar)
 *   - Cache invalidation tek noktadan tetiklensin (bir mutation tüm widget'ları
 *     anında günceller)
 *
 * AppShell sidebar de bu queryKey'i kullanır.
 */
export const REVIEW_QUEUE_SUMMARY_KEY = ['review-queue-summary'] as const;

function useReviewQueueSummary() {
  const active = useAuth((s) => s.active);
  return useQuery({
    queryKey: [...REVIEW_QUEUE_SUMMARY_KEY, active.orgSlug, active.tenantSlug],
    enabled: !!active.orgSlug,
    queryFn: async () => {
      const res = await api.get<{ data: ReviewSummary }>('/review-queue/summary?scope=org');
      return res.data.data;
    },
    refetchInterval: 60_000, // 30s → 60s (review queue real-time değil)
    staleTime: 30_000,
  });
}

export function PendingReviewBanner({ type }: { type: ReviewType }) {
  const cfg = TYPE_CONFIG[type];
  const q = useReviewQueueSummary();

  const count = q.data?.[type] ?? 0;
  if (count === 0) return null;

  return (
    <Link
      to={`/review-queue?type=${cfg.reviewType}&scope=org`}
      className="block mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-700 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 grid place-items-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <span className="text-xl">{cfg.icon}</span>
          </div>
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-200">
              {count} {cfg.entity} {cfg.verb}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Yüklediğin/oluşturulan kayıtlar otomatik yaratıldı — onaylanmadıkları için bu
              listede görünmüyor. Tıkla, tek tek onayla veya reddet.
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Onay Bekleyenler'e Git →
        </span>
      </div>
    </Link>
  );
}

/**
 * PendingReviewDashboardWidget — Dashboard'da tüm kategorilerdeki bekleyenleri
 * tek bir kartta listeler. Toplam 0 ise hiç görünmez.
 */
export function PendingReviewDashboardWidget() {
  const q = useReviewQueueSummary();

  const s = q.data;
  if (!s || s.total === 0) return null;

  const rows: { key: ReviewType; count: number }[] = [
    { key: 'payables', count: s.payables },
    { key: 'sales_invoices', count: s.sales_invoices },
    { key: 'companies', count: s.companies },
    { key: 'persons', count: s.persons },
  ].filter((r) => r.count > 0) as { key: ReviewType; count: number }[];

  return (
    <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-700">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 grid place-items-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">
              Doğrulama Bekleyen {s.total} Kayıt
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Otomatik yaratılan kayıtlar — listede görünmüyor, tek tek onaylanmalı.
            </p>
          </div>
        </div>
        <Link
          to="/review-queue?scope=org"
          className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Onay Bekleyenler →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {rows.map((r) => {
          const cfg = TYPE_CONFIG[r.key];
          return (
            <Link
              key={r.key}
              to={`/review-queue?type=${cfg.reviewType}&scope=org`}
              className="bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-lg p-3 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{cfg.icon}</span>
                <span className="text-xs text-blue-700 dark:text-blue-300 capitalize">
                  {cfg.entity}
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{r.count}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * PendingReviewEmptyHint — Liste tamamen boşken, ama review queue'da
 * kayıt varsa kullanıcıya yönlendirme yapar. Empty state'in altına eklenir.
 */
export function PendingReviewEmptyHint({ type }: { type: ReviewType }) {
  const cfg = TYPE_CONFIG[type];
  const q = useReviewQueueSummary();

  const count = q.data?.[type] ?? 0;
  if (count === 0) return null;

  return (
    <div className="mt-4 text-center">
      <Link
        to={`/review-queue?type=${cfg.reviewType}&scope=org`}
        className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        <span>💡</span>
        <span>
          <strong>{count}</strong> {cfg.entity} onay bekliyor — Doğrulama Bekleyenler sayfasında
        </span>
      </Link>
    </div>
  );
}
