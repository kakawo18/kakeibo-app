import { describe, expect, it } from 'vitest';
import { monthStart, monthsBetween, nextDay, nextMonthStart, parseDay, shiftMonth } from '@/server/mcp/dates';
import { UserFacingError } from '@/server/errors';

describe('parseDay', () => {
  it('YYYY-MM-DD をその日の0時（日本時間）にする', () => {
    expect(parseDay('2026-03-01', 'from')).toEqual(new Date(2026, 2, 1));
  });

  it('存在しない日付は翌月に繰り越さず、説明つきのエラーにする', () => {
    expect(() => parseDay('2026-02-30', 'from')).toThrow(UserFacingError);
    expect(() => parseDay('2026-13-01', 'to')).toThrow(UserFacingError);
  });
});

describe('月の計算', () => {
  it('年をまたいでずらせる', () => {
    expect(shiftMonth('2026-02', 2)).toBe('2025-12');
    expect(shiftMonth('2025-12', -1)).toBe('2026-01');
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
  });

  it('月の始まりと翌月の始まり、翌日', () => {
    expect(monthStart('2026-03')).toEqual(new Date(2026, 2, 1));
    expect(nextMonthStart('2026-12')).toEqual(new Date(2027, 0, 1));
    expect(nextDay(new Date(2026, 1, 28))).toEqual(new Date(2026, 2, 1));
  });
});
