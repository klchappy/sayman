/**
 * Route prefetch — kullanıcı login olunca arka planda sık ziyaret edilen sayfaların
 * lazy chunk'larını indir. Suspense fallback'i ("Sayfa yükleniyor…") çoğu navigation'da
 * görünmez, anında render olur.
 *
 * Kullanım: AppShell mount olduğunda çağır.
 */

// requestIdleCallback yoksa setTimeout fallback
const onIdle = (cb: () => void, timeout = 2000) => {
  if (typeof window === 'undefined') return;
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) {
    ric(cb);
  } else {
    setTimeout(cb, timeout);
  }
};

let _prefetched = false;

export function prefetchCommonRoutes(): void {
  if (_prefetched) return;
  _prefetched = true;

  onIdle(() => {
    // Çok ziyaret edilen sayfaları arka planda yükle
    // Vite import() promise'lerini cache'ler, sonraki gerçek navigation'da anlık olur
    void import('../pages/Dashboard');
    void import('../pages/finance/Payables');
    void import('../pages/SalesInvoices');
    void import('../pages/Cari');
    void import('../pages/ReviewQueue');
    void import('../pages/Notifications');
    void import('../pages/Tasks');
  }, 1500);

  // Ağır vendor'lar (charts) — orta gecikme
  onIdle(() => {
    void import('../pages/Forecast');
    void import('../pages/BalanceSheet');
    void import('../pages/ProfitLoss');
  }, 3500);
}
