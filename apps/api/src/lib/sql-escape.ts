/**
 * SQL ILIKE pattern escape — user input içindeki `%` ve `_` wildcard'larını
 * literal hale getirir.
 *
 * Sorun: `ilike(col, name)` veya `\`%\${input}%\`` kullanıldığında, kullanıcı
 * input'una `%` koyduğunda bu LIKE wildcard'ı olarak yorumlanıyor — semantik
 * bug (search "fo%" ile "fooo bar" eşleşiyor). Drizzle parametrize ettiği için
 * SQL injection değil, ama beklenmeyen eşleşmeler oluyor.
 *
 * Kullanım:
 *   const safe = escapeIlike(req.query.search);
 *   ilike(table.name, '%' + safe + '%')
 */
export function escapeIlike(input: string | null | undefined): string {
  if (input == null) return '';
  // \, %, _ literal olmalı — postgresql LIKE backslash escape default
  return String(input).replace(/[\\%_]/g, '\\$&');
}

/**
 * `%term%` wildcard wrapper — escape edilmiş haliyle.
 */
export function ilikePattern(input: string | null | undefined): string {
  return '%' + escapeIlike(input) + '%';
}
