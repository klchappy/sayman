/**
 * TruncatedListWarning — Sunucu liste yanıtı LIMIT'e takıldıysa kullanıcıyı uyarır.
 *
 * Sorun: Önceden /v1/employees gibi endpoint'ler hard LIMIT 500 ile sonuçları
 * kesiyordu, kullanıcı bunu fark edemiyordu — "personel kayboldu" algısı.
 *
 * Çözüm: API artık her liste yanıtında { data, count, total, limit, truncated }
 * meta döndürüyor. Bu komponent `truncated=true` ise üst bantta uyarı gösterir.
 *
 * Kullanım:
 *   const list = useQuery(...);
 *   <TruncatedListWarning meta={list.data} />
 */

interface ListMeta {
  count?: number;
  total?: number;
  limit?: number;
  truncated?: boolean;
}

export function TruncatedListWarning({ meta }: { meta: ListMeta | { data: unknown; truncated?: boolean } | undefined }) {
  if (!meta) return null;
  const m = meta as ListMeta;
  if (!m.truncated || !m.total) return null;
  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm">
      <div className="flex items-start gap-2">
        <span className="text-amber-600">⚠️</span>
        <div className="flex-1">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Liste kesildi — {m.count}/{m.total} kayıt gösteriliyor
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Toplam <strong>{m.total}</strong> kayıt var ama bir sayfada en fazla{' '}
            <strong>{m.limit}</strong> gösteriliyor. Aradığın kayıt görünmüyorsa filtre
            kullanarak daralt.
          </p>
        </div>
      </div>
    </div>
  );
}
