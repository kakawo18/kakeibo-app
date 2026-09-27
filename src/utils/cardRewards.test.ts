import { describe, expect, it } from 'vitest';
import { testSettings, tx } from '@/test/fixtures';
import { calculateMonthlyCardRewards } from '@/utils/cardRewards';

describe('calculateMonthlyCardRewards', () => {
  it('還元率のあるカードの支出だけを対象に、1件ごとに切り捨てて合計する', () => {
    const result = calculateMonthlyCardRewards(
      [
        tx('2026-03-01', 'expense', 1_050, '食費', { paymentMethod: '楽天カード' }),
        tx('2026-03-02', 'expense', 1_050, '食費', { paymentMethod: '楽天カード' }),
        tx('2026-03-03', 'expense', 5_000, '食費', { paymentMethod: '現金' }),
        tx('2026-03-04', 'expense', 5_000, '食費', { paymentMethod: '還元なしカード' }),
        tx('2026-03-05', 'income', 5_000, '給与', { paymentMethod: '楽天カード' }),
      ],
      testSettings.paymentMethods
    );
    // 1,050 × 1% = 10.5 → 10pt を2件
    expect(result.cardRewards).toEqual({ 楽天カード: { amount: 2_100, points: 20 } });
    expect(result.totalPoints).toBe(20);
    expect(result.totalAmount).toBe(2_100);
  });
});
