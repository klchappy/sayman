/**
 * Para birimi + tarih formatting helper'ları — tüm sayfalarda tek kaynak.
 *
 * Önce her sayfa kendi `fmtTRY` fonksiyonunu yazıyordu (20+ kopya).
 * Bundle size + tutarsızlık riski → tek modül.
 */

/** "1.234,56 TL" formatında TRY. null/undefined → "-" */
export function fmtTRY(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

/** Kısa para (decimal'siz) — dashboard, badge için. */
export function fmtTRYShort(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Generic currency formatter — ERP cari için (TRY/USD/EUR vs.) */
export function fmtMoney(
  v: string | number | null | undefined,
  currency: string = 'TRY',
): string {
  if (v === null || v === undefined) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(n);
  } catch {
    // Bilinmeyen currency kodu → fallback
    return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}`;
  }
}

/** YYYY-MM-DD → "16 May 2026" */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** YYYY-MM-DD → "16 May 2026, 14:30" */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Bugün, dün, 3 gün önce gibi göreceli zaman */
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return fmtDate(date);
}
