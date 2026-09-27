import { describe, expect, it } from 'vitest';
import { calculateNetFromGross, estimateGrossFromNet } from '@/utils/tax/estimateGross';

const YEARS = [2024, 2025, 2026];
const NETS = [1_500_000, 3_000_000, 3_900_000, 6_000_000, 9_000_000];

describe('estimateGrossFromNet', () => {
  it.each(YEARS)('%i年分: 推定した額面から手取りを計算し直すとほぼ元に戻る', (year) => {
    for (const net of NETS) {
      const { gross } = estimateGrossFromNet(net, year);
      const back = calculateNetFromGross(gross, year).net;
      expect(Math.abs(back - net)).toBeLessThan(1_000);
    }
  });

  it('額面 = 手取り + 社会保険料 + 所得税 + 住民税（グラフの段の合計が一致する）', () => {
    const e = estimateGrossFromNet(4_000_000, 2026);
    expect(e.net + e.socialInsurance + e.incomeTax + e.residentTax).toBe(e.gross);
  });

  it('手取りが多いほど額面も多い（単調増加）', () => {
    const grosses = NETS.map((net) => estimateGrossFromNet(net, 2026).gross);
    expect([...grosses].sort((a, b) => a - b)).toEqual(grosses);
  });

  it('手取り0以下は0を返す', () => {
    expect(estimateGrossFromNet(0, 2026).gross).toBe(0);
  });

  it('額面500万円の手取りはおよそ380〜400万円（一般的な目安の範囲）', () => {
    const { net } = calculateNetFromGross(5_000_000, 2026);
    expect(net).toBeGreaterThan(3_800_000);
    expect(net).toBeLessThan(4_000_000);
  });
});
