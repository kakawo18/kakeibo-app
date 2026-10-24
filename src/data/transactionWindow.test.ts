import { describe, expect, it } from 'vitest';
import { tx } from '@/test/fixtures';
import {
  mergeTransactionRanges,
  monthNeedsHistory,
  recentWindowStart,
  yearNeedsHistory,
} from '@/data/transactionWindow';

describe('recentWindowStart（#125）', () => {
  it('今月を含めて13か月前の月初（ローカル時刻の0:00）', () => {
    expect(recentWindowStart(new Date(2026, 8, 28, 15))).toEqual(new Date(2025, 8, 1));
  });

  it('年をまたいでも正しい', () => {
    expect(recentWindowStart(new Date(2026, 0, 1, 0, 0, 1))).toEqual(new Date(2025, 0, 1));
    expect(recentWindowStart(new Date(2026, 11, 31, 23))).toEqual(new Date(2025, 11, 1));
  });

  it('今年の1月は必ず直近に入る（年間 KPI を直近だけで出せる）', () => {
    for (let month = 0; month < 12; month++) {
      const now = new Date(2026, month, 15);
      expect(recentWindowStart(now).getTime()).toBeLessThanOrEqual(new Date(2026, 0, 1).getTime());
    }
  });
});

describe('mergeTransactionRanges', () => {
  it('直近・過去の順につなげ、全体が日付の新しい順になる', () => {
    const recent = [tx('2026-09-10', 'expense', 1, '食費'), tx('2025-09-01', 'expense', 2, '食費')];
    const older = [tx('2025-08-31', 'expense', 3, '食費'), tx('2024-01-01', 'expense', 4, '食費')];
    const merged = mergeTransactionRanges(recent, older);
    expect(merged.map((t) => t.amount)).toEqual([1, 2, 3, 4]);
    const times = merged.map((t) => t.date.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('片方が空ならもう片方をそのまま返す（参照を変えない）', () => {
    const recent = [tx('2026-09-10', 'expense', 1, '食費')];
    expect(mergeTransactionRanges(recent, [])).toBe(recent);
    expect(mergeTransactionRanges([], recent)).toBe(recent);
  });
});

describe('monthNeedsHistory / yearNeedsHistory', () => {
  const recentFrom = new Date(2025, 8, 1); // 2026年9月時点の直近の始まり

  it('直近のいちばん古い月も過去が要る（前月比・カレンダーの前月の日付のため）', () => {
    expect(monthNeedsHistory('2025-08', recentFrom)).toBe(true);
    expect(monthNeedsHistory('2025-09', recentFrom)).toBe(true);
    expect(monthNeedsHistory('2025-10', recentFrom)).toBe(false);
    expect(monthNeedsHistory('2026-09', recentFrom)).toBe(false);
  });

  it('年の1月1日が直近より前なら過去が要る。今年は要らない', () => {
    expect(yearNeedsHistory(2025, recentFrom)).toBe(true);
    expect(yearNeedsHistory(2026, recentFrom)).toBe(false);
    expect(yearNeedsHistory(2026, new Date(2025, 0, 1))).toBe(false);
    expect(yearNeedsHistory(2025, new Date(2025, 0, 1))).toBe(false);
  });
});
