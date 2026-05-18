import { describe, expect, it, vi } from 'vitest';
import { bulkInsertWithFallback } from './bulk-insert';

describe('bulkInsertWithFallback', () => {
  it('tüm satırlar başarılıysa bulk yolundan döner, insertOne çağrılmaz', async () => {
    const insertAll = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const insertOne = vi.fn();
    const r = await bulkInsertWithFallback({
      rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
      insertAll,
      insertOne,
    });
    expect(r.inserted).toEqual(['a', 'b', 'c']);
    expect(r.failed).toEqual([]);
    expect(insertAll).toHaveBeenCalledTimes(1);
    expect(insertOne).not.toHaveBeenCalled();
  });

  it('bulk fail olunca satır satır gider, başarısızları topla', async () => {
    const insertAll = vi.fn().mockRejectedValue(new Error('FK violation'));
    const insertOne = vi.fn()
      .mockResolvedValueOnce([{ id: 'a' }]) // 1. satır ok
      .mockRejectedValueOnce(new Error('unique constraint'))   // 2. satır fail
      .mockResolvedValueOnce([{ id: 'c' }]); // 3. satır ok
    const r = await bulkInsertWithFallback({
      rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
      insertAll,
      insertOne,
    });
    expect(r.inserted).toEqual(['a', 'c']);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]).toMatchObject({
      row_index: 1,
      row: { x: 2 },
      error: 'unique constraint',
    });
    expect(insertOne).toHaveBeenCalledTimes(3);
  });

  it('boş row dizisi → boş sonuç', async () => {
    const insertAll = vi.fn().mockResolvedValue([]);
    const insertOne = vi.fn();
    const r = await bulkInsertWithFallback({ rows: [], insertAll, insertOne });
    expect(r.inserted).toEqual([]);
    expect(r.failed).toEqual([]);
  });

  it('bulk fail + tüm satırlar fail → boş inserted', async () => {
    const insertAll = vi.fn().mockRejectedValue(new Error('whole batch failed'));
    const insertOne = vi.fn().mockRejectedValue(new Error('row failed'));
    const r = await bulkInsertWithFallback({
      rows: [{ x: 1 }, { x: 2 }],
      insertAll,
      insertOne,
    });
    expect(r.inserted).toEqual([]);
    expect(r.failed).toHaveLength(2);
  });
});
