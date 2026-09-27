import { describe, expect, it } from 'vitest';
import { monthRange } from '@/utils/dateUtils';

describe('monthRange', () => {
  it('開始月から終了月までを年をまたいで並べる', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('同じ月なら1件、逆順なら空', () => {
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
    expect(monthRange('2026-04', '2026-03')).toEqual([]);
  });
});
