import { describe, expect, it } from 'vitest';
import { testRules as rules, tx } from '@/test/fixtures';
import { resolveFlagsOnEdit } from '@/domain/transactionRules';

describe('役割の判定', () => {
  it('カテゴリに付いた役割で判定する', () => {
    expect(rules.isInvestment(tx('2026-01-10', 'expense', 1, '投資'))).toBe(true);
    expect(rules.isAdvancePayment(tx('2026-01-10', 'expense', 1, '立替'))).toBe(true);
    expect(rules.isAdvanceRepayment(tx('2026-01-10', 'income', 1, '立替回収'))).toBe(true);
    expect(rules.isSalaryIncome(tx('2026-01-10', 'income', 1, '給与', { subcategory: '賞与' }))).toBe(true);
  });

  it('サブカテゴリに付いた役割も効く（カテゴリ側に役割が無くても）', () => {
    const nisa = tx('2026-01-10', 'expense', 1, '固定費', { subcategory: '積立NISA' });
    const rent = tx('2026-01-10', 'expense', 1, '固定費', { subcategory: '家賃' });
    expect(rules.isInvestment(nisa)).toBe(true);
    expect(rules.isInvestment(rent)).toBe(false);
    expect(rules.isExcludedFromPace(rent)).toBe(true);
  });

  it('同名のサブカテゴリでも親カテゴリが違えば別物として扱う', () => {
    const other = tx('2026-01-10', 'expense', 1, '食費', { subcategory: '積立NISA' });
    expect(rules.isInvestment(other)).toBe(false);
  });

  it('配当は給与収入として扱わない', () => {
    const dividend = tx('2026-01-10', 'income', 1, 'その他', { subcategory: '配当収入' });
    expect(rules.isSalaryIncome(dividend)).toBe(false);
  });
});

describe('支出・収入からの除外', () => {
  it('投資・立替金・affectsExpense=false の取引は支出から外す', () => {
    expect(rules.isExcludedFromExpense(tx('2026-01-10', 'expense', 1, '投資'))).toBe(true);
    expect(rules.isExcludedFromExpense(tx('2026-01-10', 'expense', 1, '立替'))).toBe(true);
    expect(
      rules.isExcludedFromExpense(tx('2026-01-10', 'expense', 1, '食費', { affectsExpense: false }))
    ).toBe(true);
    expect(rules.isExcludedFromExpense(tx('2026-01-10', 'expense', 1, '食費'))).toBe(false);
  });

  it('affectsExpense が未設定（古いデータ）なら支出に含める', () => {
    expect(
      rules.isExcludedFromExpense(tx('2026-01-10', 'expense', 1, '食費', { affectsExpense: undefined }))
    ).toBe(false);
  });

  it('立替回収だけを収入から外す', () => {
    expect(rules.isExcludedFromIncome(tx('2026-01-10', 'income', 1, '立替回収'))).toBe(true);
    expect(rules.isExcludedFromIncome(tx('2026-01-10', 'income', 1, '給与'))).toBe(false);
  });
});

describe('deriveTransactionFlags', () => {
  it('現金扱いの支払方法・支払方法なしは通常の取引', () => {
    expect(rules.deriveTransactionFlags('食費', '現金')).toEqual({
      transactionType: 'normal',
      affectsExpense: true,
    });
    expect(rules.deriveTransactionFlags('食費')).toEqual({
      transactionType: 'normal',
      affectsExpense: true,
    });
  });

  it('カードはカード支払いとして購入月の支出に含める', () => {
    expect(rules.deriveTransactionFlags('食費', '楽天カード')).toEqual({
      transactionType: 'card_payment',
      affectsExpense: true,
    });
  });

  it('設定に無い支払方法はカード扱い（旧データ互換）', () => {
    expect(rules.deriveTransactionFlags('食費', '昔使っていたカード').transactionType).toBe(
      'card_payment'
    );
  });
});

describe('resolveFlagsOnEdit（#99: 編集で会計上の意味を変えない）', () => {
  const withdrawal = {
    paymentMethod: '楽天カード',
    transactionType: 'card_withdrawal' as const,
    affectsExpense: false,
  };

  it('支出から外していた取引は、メモ・カテゴリ・支払方法を変えても外れたまま', () => {
    expect(resolveFlagsOnEdit(withdrawal, { category: '食費', paymentMethod: '楽天カード' }, rules))
      .toEqual({ transactionType: 'card_withdrawal', affectsExpense: false });
    expect(resolveFlagsOnEdit(withdrawal, { category: '固定費', paymentMethod: '現金' }, rules))
      .toEqual({ transactionType: 'card_withdrawal', affectsExpense: false });
  });

  it('支払方法が変わらなければ、今の設定と食い違っても既存の取引タイプを保つ', () => {
    // 記録後に設定で「現金扱い」を切り替えた、などのケース
    const existing = { paymentMethod: '楽天カード', transactionType: 'normal' as const, affectsExpense: true };
    expect(resolveFlagsOnEdit(existing, { category: '食費', paymentMethod: '楽天カード' }, rules))
      .toEqual({ transactionType: 'normal', affectsExpense: true });
  });

  it('支払方法を変えたら導出し直す', () => {
    const existing = { paymentMethod: '現金', transactionType: 'normal' as const, affectsExpense: true };
    expect(resolveFlagsOnEdit(existing, { category: '食費', paymentMethod: '楽天カード' }, rules))
      .toEqual({ transactionType: 'card_payment', affectsExpense: true });
    expect(resolveFlagsOnEdit(
      { paymentMethod: '楽天カード', transactionType: 'card_payment', affectsExpense: true },
      { category: '食費', paymentMethod: '' },
      rules
    )).toEqual({ transactionType: 'normal', affectsExpense: true });
  });

  it('支払方法の「未設定」と空文字は同じものとして扱う', () => {
    const existing = { paymentMethod: undefined, transactionType: 'normal' as const, affectsExpense: true };
    expect(resolveFlagsOnEdit(existing, { category: '食費', paymentMethod: '' }, rules))
      .toEqual({ transactionType: 'normal', affectsExpense: true });
  });
});
