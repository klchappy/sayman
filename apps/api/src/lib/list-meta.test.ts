import { describe, expect, it } from 'vitest';
import { listMeta, LIST_LIMITS } from './list-meta';

describe('listMeta', () => {
  it('truncated=false: total < limit, count = rows.length', () => {
    const rows = [1, 2, 3];
    const m = listMeta(rows, 3, LIST_LIMITS.medium);
    expect(m).toEqual({
      count: 3,
      total: 3,
      limit: 200,
      truncated: false,
    });
  });

  it('truncated=true: total > rows.length', () => {
    const rows = new Array(200).fill(null);
    const m = listMeta(rows, 543, LIST_LIMITS.medium);
    expect(m.truncated).toBe(true);
    expect(m.count).toBe(200);
    expect(m.total).toBe(543);
  });

  it('boş liste: truncated=false', () => {
    const m = listMeta([], 0, LIST_LIMITS.small);
    expect(m).toEqual({ count: 0, total: 0, limit: 50, truncated: false });
  });

  it('LIST_LIMITS sabit değerleri', () => {
    expect(LIST_LIMITS.small).toBe(50);
    expect(LIST_LIMITS.medium).toBe(200);
    expect(LIST_LIMITS.large).toBe(500);
    expect(LIST_LIMITS.xl).toBe(1000);
  });
});
