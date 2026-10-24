import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT, MAX_NAME_LENGTH, validateAmount, validateName } from '@/utils/validation';

describe('validateName（#117）', () => {
  it('Firestore ルールの上限（50文字）ちょうどまでは通す', () => {
    expect(MAX_NAME_LENGTH).toBe(50);
    expect(validateName('あ'.repeat(50), 'カテゴリ名')).toBeNull();
  });
  it('51文字は保存前にエラーにする', () => {
    expect(validateName('あ'.repeat(51), 'カテゴリ名')).toBe('カテゴリ名は50文字以内にしてください');
  });
  it('空・空白だけは入力を求める', () => {
    expect(validateName('  ', 'カテゴリ名')).toBe('カテゴリ名を入力してください');
  });
  it('前後の空白は数えない', () => {
    expect(validateName(` ${'あ'.repeat(50)} `, 'カテゴリ名')).toBeNull();
  });
});

describe('validateAmount（#117）', () => {
  it.each([1, '1', 1500, '1500', MAX_AMOUNT])('%s は通す', (value) => {
    expect(validateAmount(value)).toBeNull();
  });
  it.each(['', null, undefined, 0, '0', -1, '-5', 'abc', NaN, Infinity, '1e400'])(
    '%s は金額としてエラー',
    (value) => {
      expect(validateAmount(value)).toBe('1円以上の金額を入力してください');
    }
  );
  it('上限を超える金額は桁の打ち間違いとしてエラー', () => {
    expect(validateAmount(MAX_AMOUNT + 1)).toBe('金額が大きすぎます（10億円まで）');
  });
  it('小数は切り捨てた結果が1円未満ならエラー', () => {
    expect(validateAmount(0.5)).toBe('1円以上の金額を入力してください');
    expect(validateAmount(1.9)).toBeNull();
  });
});
