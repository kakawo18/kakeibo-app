import { describe, expect, it } from 'vitest';
import { UserSettings } from '@/types';
import { testSettings, tx } from '@/test/fixtures';
import { UserFacingError } from '@/server/errors';
import {
  NewTransactionRequest,
  draftNewTransaction,
  draftTransactionChange,
  toNewTransactionInput,
  toTransactionUpdates,
} from './transactionDraft';
import { duplicateWarnings, findPossibleDuplicates } from './duplicates';

const TODAY = new Date(2026, 9, 26, 15, 30);

const lunch: NewTransactionRequest = {
  date: '2026-10-26',
  type: 'expense',
  amount: 1_200,
  category: '食費',
  paymentMethod: '現金',
  description: '  ランチ  ',
};

/** カテゴリの改名・アーカイブを含む設定 */
const settingsWith = (patch: (s: UserSettings) => UserSettings): UserSettings => patch(structuredClone(testSettings));

const renamedFood = settingsWith((s) => ({
  ...s,
  categories: s.categories.map((c) =>
    c.id === 'food'
      ? {
          ...c,
          name: '食料品',
          aliases: ['食費'],
          subcategories: [...c.subcategories, { id: 'old', name: '惣菜', roles: [], archived: true }],
        }
      : c.id === 'advance'
        ? { ...c, archived: true }
        : c
  ),
}));

const rejects = (fn: () => unknown, message: RegExp) => {
  expect(fn).toThrow(UserFacingError);
  expect(fn).toThrow(message);
};

describe('draftNewTransaction', () => {
  it('入力を整え、集計での扱いを添えて返す', () => {
    const { draft, view, warnings } = draftNewTransaction(lunch, testSettings, TODAY);

    expect(draft).toEqual({
      date: '2026-10-26',
      type: 'expense',
      amount: 1_200,
      category: '食費',
      paymentMethod: '現金',
      description: 'ランチ',
    });
    expect(view).toMatchObject({ category: '食費', subcategory: null, accounting: '支出に含める' });
    expect(warnings).toEqual([]);
  });

  it('役割の付いたカテゴリでは、集計の扱いを説明する', () => {
    const view = (request: Partial<NewTransactionRequest>) =>
      draftNewTransaction({ ...lunch, ...request }, testSettings, TODAY).view.accounting;

    expect(view({ category: '投資', paymentMethod: undefined })).toBe('投資として別に集計（支出に含めない）');
    expect(view({ category: '固定費', subcategory: '積立NISA' })).toBe('投資として別に集計（支出に含めない）');
    expect(view({ category: '立替' })).toBe('立替金（支出に含めない）');
    expect(view({ type: 'income', category: '立替回収', paymentMethod: undefined })).toBe('立替回収（収入に含めない）');
    expect(view({ type: 'income', category: '給与', paymentMethod: undefined })).toBe('収入に含める');
  });

  it('今日より後の日付には警告を付ける', () => {
    const { warnings } = draftNewTransaction({ ...lunch, date: '2026-10-27' }, testSettings, TODAY);
    expect(warnings.map((w) => w.kind)).toEqual(['future_date']);
  });

  it('アプリの画面で作れない値は拒否する', () => {
    const draft = (request: Partial<NewTransactionRequest>) => () =>
      draftNewTransaction({ ...lunch, ...request }, testSettings, TODAY);

    rejects(draft({ category: '交際費' }), /カテゴリ「交際費」はありません/);
    rejects(draft({ category: '給与' }), /収入のカテゴリです/);
    rejects(draft({ subcategory: '家賃' }), /「食費」にサブカテゴリ「家賃」はありません/);
    rejects(draft({ paymentMethod: 'PayPay' }), /支払方法「PayPay」はありません/);
    rejects(draft({ type: 'income', category: '給与' }), /収入には支払方法を付けません/);
    rejects(draft({ description: 'あ'.repeat(201) }), /200文字以内/);
    rejects(draft({ amount: 0 }), /1円以上/);
    rejects(draft({ amount: 1_000_000_001 }), /大きすぎます/);
    rejects(draft({ amount: 1.5 }), /整数/);
    rejects(draft({ date: '2026-02-30' }), /存在しません/);
  });

  it('改名前の名前・アーカイブしたカテゴリとサブカテゴリは受け付けない', () => {
    const draft = (request: Partial<NewTransactionRequest>) => () =>
      draftNewTransaction({ ...lunch, ...request }, renamedFood, TODAY);

    rejects(draft({ category: '食費' }), /「食料品」に改名されています/);
    rejects(draft({ category: '立替' }), /アーカイブされている/);
    rejects(draft({ category: '食料品', subcategory: '惣菜' }), /アーカイブされている/);
    expect(draftNewTransaction({ ...lunch, category: '食料品' }, renamedFood, TODAY).draft.category).toBe('食料品');
  });

  it('収入と支出で同じ名前のカテゴリがあれば、種類の合うほうを使う', () => {
    const settings = settingsWith((s) => ({
      ...s,
      categories: [...s.categories, { ...s.categories[0], id: 'other-expense', name: 'その他', subcategories: [] }],
    }));
    const { draft } = draftNewTransaction({ ...lunch, category: 'その他' }, settings, TODAY);
    expect(draft.category).toBe('その他');
  });
});

describe('toNewTransactionInput', () => {
  it('今日の取引は記録した時刻、ほかの日はその日の0時にし、集計のフラグを付ける', () => {
    const { draft } = draftNewTransaction(lunch, testSettings, TODAY);
    expect(toNewTransactionInput(draft, testSettings, TODAY)).toMatchObject({
      date: TODAY,
      transactionType: 'normal',
      affectsExpense: true,
      description: 'ランチ',
    });

    const yesterday = draftNewTransaction({ ...lunch, date: '2026-10-25', paymentMethod: '楽天カード' }, testSettings, TODAY);
    expect(toNewTransactionInput(yesterday.draft, testSettings, TODAY)).toMatchObject({
      date: new Date(2026, 9, 25),
      transactionType: 'card_payment',
    });
  });

  it('確認の後に設定から消えたカテゴリなら、確認からやり直させる', () => {
    const { draft } = draftNewTransaction(lunch, testSettings, TODAY);
    const withoutFood = settingsWith((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== 'food') }));
    rejects(() => toNewTransactionInput(draft, withoutFood, TODAY), /確認からやり直してください/);
  });
});

describe('draftTransactionChange', () => {
  const existing = tx('2026-10-20', 'expense', 1_200, '食費', {
    id: 'abc',
    subcategory: '外食',
    paymentMethod: '楽天カード',
    transactionType: 'card_payment',
    description: 'ランチ',
  });

  it('変わる項目だけを返し、変更前と変更後を並べる', () => {
    const result = draftTransactionChange(existing, { amount: 1_300, description: 'ランチ（大盛り）' }, testSettings, TODAY);

    expect(result.changes).toEqual({ amount: 1_300, description: 'ランチ（大盛り）' });
    expect(result.changedFields).toEqual(['amount', 'description']);
    expect(result.before).toMatchObject({ id: 'abc', amount: 1_200, description: 'ランチ' });
    expect(result.after).toMatchObject({ id: 'abc', amount: 1_300, description: 'ランチ（大盛り）', subcategory: '外食' });
  });

  it('今と同じ値は変更なしとして扱う', () => {
    const result = draftTransactionChange(
      existing,
      { amount: 1_200, category: '食費', subcategory: '外食', paymentMethod: '楽天カード', description: ' ランチ ', date: '2026-10-20' },
      testSettings,
      TODAY
    );
    expect(result.changedFields).toEqual([]);
  });

  it('改名前の名前で記録された取引に今の名前を渡しても、変更なしになる', () => {
    const old = tx('2026-10-20', 'expense', 500, '食費', { id: 'old' });
    const result = draftTransactionChange(old, { category: '食料品' }, renamedFood, TODAY);
    expect(result.changedFields).toEqual([]);
    expect(result.before.category).toBe('食料品');
  });

  it('カテゴリを変えてサブカテゴリを指定しなければ、サブカテゴリを消す', () => {
    const result = draftTransactionChange(existing, { category: '固定費' }, testSettings, TODAY);
    expect(result.changes).toEqual({ category: '固定費', subcategory: '' });
    expect(result.after.subcategory).toBeNull();
  });

  it('空文字はサブカテゴリ・支払方法・メモを消す', () => {
    const result = draftTransactionChange(existing, { subcategory: '', paymentMethod: '', description: '' }, testSettings, TODAY);
    expect(result.changes).toEqual({ subcategory: '', paymentMethod: '', description: '' });
    expect(result.after).toMatchObject({ subcategory: null, paymentMethod: null, description: null });
  });

  it('別のカテゴリのサブカテゴリ・収入の支払方法・違う種類のカテゴリは拒否する', () => {
    rejects(() => draftTransactionChange(existing, { subcategory: '家賃' }, testSettings, TODAY), /サブカテゴリ「家賃」はありません/);
    rejects(() => draftTransactionChange(existing, { category: '給与' }, testSettings, TODAY), /収入のカテゴリです/);
    const salary = tx('2026-10-25', 'income', 300_000, '給与', { id: 's' });
    rejects(() => draftTransactionChange(salary, { paymentMethod: '現金' }, testSettings, TODAY), /収入には支払方法を付けません/);
  });

  it('集計の扱いが変わる編集は、変更後の扱いを見せる', () => {
    const result = draftTransactionChange(existing, { category: '投資' }, testSettings, TODAY);
    expect(result.before.accounting).toBe('支出に含める');
    expect(result.after.accounting).toBe('投資として別に集計（支出に含めない）');
  });
});

describe('toTransactionUpdates', () => {
  const existing = tx('2026-10-20', 'expense', 1_200, '食費', {
    id: 'abc',
    paymentMethod: '楽天カード',
    transactionType: 'card_payment',
  });

  it('メモだけを直しても、カード払いの扱いを変えない（#99）', () => {
    const updates = toTransactionUpdates(existing, { description: '会社の飲み物' }, testSettings, TODAY);
    expect(updates).toEqual({ description: '会社の飲み物', transactionType: 'card_payment', affectsExpense: true });
  });

  it('支出から外した取引は、何を直しても外したまま', () => {
    const withdrawn = { ...existing, affectsExpense: false, transactionType: 'card_withdrawal' as const };
    expect(toTransactionUpdates(withdrawn, { amount: 1 }, testSettings, TODAY)).toMatchObject({ affectsExpense: false });
  });

  it('支払方法を変えたら、今の設定から扱いを決め直す', () => {
    expect(toTransactionUpdates(existing, { paymentMethod: '現金' }, testSettings, TODAY)).toMatchObject({
      paymentMethod: '現金',
      transactionType: 'normal',
    });
  });

  it('日付はその日の0時にする', () => {
    expect(toTransactionUpdates(existing, { date: '2026-10-26' }, testSettings, TODAY)?.date).toEqual(new Date(2026, 9, 26));
  });

  it('すでに反映済みなら null（同じ確認トークンの2回目）', () => {
    const applied = { ...existing, amount: 1_300 };
    expect(toTransactionUpdates(applied, { amount: 1_300 }, testSettings, TODAY)).toBeNull();
  });
});

describe('二重登録の判定', () => {
  const sameDay = [
    tx('2026-10-26', 'expense', 1_200, '食費', { id: 'a', description: 'セブン' }),
    tx('2026-10-26', 'expense', 980, '食費', { id: 'b' }),
    tx('2026-10-26', 'income', 1_200, 'その他', { id: 'c' }),
    tx('2026-10-25', 'expense', 1_200, '食費', { id: 'd' }),
  ];

  it('同じ日・同じ種類・同じ金額だけを返す', () => {
    const found = findPossibleDuplicates({ date: '2026-10-26', type: 'expense', amount: 1_200 }, sameDay);
    expect(found.map((t) => t.id)).toEqual(['a']);
  });

  it('見つかれば、その取引を添えた警告にする', () => {
    const [warning] = duplicateWarnings([sameDay[0]], testSettings);
    expect(warning.kind).toBe('possible_duplicate');
    expect(warning.transactions).toEqual([expect.objectContaining({ id: 'a', amount: 1_200, description: 'セブン' })]);
    expect(duplicateWarnings([], testSettings)).toEqual([]);
  });
});
