/**
 * bulkInsertWithFallback — CSV/JSON bulk import için "bulk önce, başarısızsa
 * satır satır" stratejisi.
 *
 * Sorun: Tek bir `db.insert(table).values([all_rows])` çağrısı, satırlardan biri
 * FK constraint'i ihlal ederse TÜM batch fail eder. Kullanıcı "0 kayıt eklendi"
 * görür ve hangi satırın patladığını bilemez.
 *
 * Çözüm:
 *   1. Önce optimistik tek shot bulk insert dene (hızlı yol)
 *   2. Başarısızsa, savepoint ile satır satır insert et — başarılıları topla,
 *      başarısızları error mesajıyla birlikte ayrı listede dön
 *
 * Kullanım:
 *   const result = await bulkInsertWithFallback({
 *     tx,
 *     rows: matched,
 *     insertOne: (row) => tx.insert(payableItems).values(row).returning({ id: payableItems.id }),
 *   });
 *   // result.inserted: string[]
 *   // result.failed: [{ row_index, row, error }, ...]
 */

export interface BulkInsertResult<R = any> {
  inserted: string[];
  failed: Array<{ row_index: number; row: R; error: string }>;
}

export interface BulkInsertParams<R> {
  rows: R[];
  /** Toplu insert — başarılı olursa list of {id} döner. Başarısız olursa exception fırlatır. */
  insertAll: (rows: R[]) => Promise<Array<{ id: string }>>;
  /** Tek satır insert — bulk başarısızsa satır satır çağrılır. */
  insertOne: (row: R) => Promise<Array<{ id: string }>>;
}

export async function bulkInsertWithFallback<R>(
  params: BulkInsertParams<R>,
): Promise<BulkInsertResult<R>> {
  // 1) Optimistik bulk
  try {
    const inserted = await params.insertAll(params.rows);
    return { inserted: inserted.map((x) => x.id), failed: [] };
  } catch {
    // Bulk başarısız — satır satır git
  }

  // 2) Satır satır
  const inserted: string[] = [];
  const failed: BulkInsertResult<R>['failed'] = [];
  for (let i = 0; i < params.rows.length; i++) {
    const row = params.rows[i]!;
    try {
      const r = await params.insertOne(row);
      if (r[0]?.id) inserted.push(r[0].id);
    } catch (err) {
      failed.push({
        row_index: i,
        row,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { inserted, failed };
}
