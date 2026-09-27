import { describe, expect, it } from 'vitest';
import { monthOptionsBetween, monthRange, parseMonthParam } from '@/utils/dateUtils';

describe('monthRange', () => {
  it('開始月から終了月までを年をまたいで並べる', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('同じ月なら1件、逆順なら空', () => {
    expect(monthRange('2026-03', '2026-03')).toEqual(['2026-03']);
    expect(monthRange('2026-04', '2026-03')).toEqual([]);
  });
});

describe('parseMonthParam（#116）', () => {
  it('YYYY-MM の実在する月だけを受け付ける', () => {
    expect(parseMonthParam('2026-03')).toBe('2026-03');
    expect(parseMonthParam('2019-12')).toBe('2019-12');
  });
  it.each([null, '', 'invalid', '2026-13', '2026-00', '2026-3', '26-03', '2026-03-01', '1969-12', '2101-01'])(
    '%s は不正として null を返す',
    (value) => {
      expect(parseMonthParam(value)).toBeNull();
    }
  );
});

describe('monthOptionsBetween（#116）', () => {
  it('範囲の月をすべて「YYYY年MM月」の選択肢にする', () => {
    expect(monthOptionsBetween('2025-12', '2026-02')).toEqual([
      { value: '2025-12', label: '2025年12月' },
      { value: '2026-01', label: '2026年01月' },
      { value: '2026-02', label: '2026年02月' },
    ]);
  });
});
