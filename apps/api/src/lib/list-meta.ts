/**
 * list-meta — Liste route'ları için "kaç kayıt gösterildi / kaç tane var / kesildi mi"
 * tutarlı response meta'sını üretir.
 *
 * Sorun: Hard LIMIT 200/500/1000 ile çalışan endpoint'ler, kullanıcının tenant'ı
 * limit'i aşan kayıt sayısına ulaştığında sessizce kesintiye uğruyordu. UI hiçbir
 * uyarı vermiyor, kullanıcı sadece ilk N kaydı görüyor.
 *
 * Kullanım:
 *   const rows = await db.select()...limit(LIST_LIMITS.medium);
 *   const total = await countTotal(db, table, whereClause);
 *   res.json({ data: rows, ...listMeta(rows, total, LIST_LIMITS.medium) });
 *
 * Response:
 *   { data: [...], count: 200, total: 543, limit: 200, truncated: true }
 *
 * Frontend bunu görüp <TruncatedListWarning total={543} shown={200} /> render eder.
 */
import { sql, SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { getDb } from '@sayman/db';

export const LIST_LIMITS = {
  small: 50,
  medium: 200,
  large: 500,
  xl: 1000,
} as const;

export interface ListMeta {
  count: number;
  total: number;
  limit: number;
  truncated: boolean;
}

export function listMeta(rows: unknown[], total: number, limit: number): ListMeta {
  return {
    count: rows.length,
    total,
    limit,
    truncated: total > rows.length,
  };
}

/**
 * Tek where clause'lu basit total count helper.
 * Karmaşık join'li route'lar için raw SQL kullan.
 */
export async function countTotal(
  table: PgTable,
  whereClause: SQL | undefined,
): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ c: sql<string>`count(*)` })
    .from(table)
    .where(whereClause);
  return Number(result[0]?.c ?? 0);
}
