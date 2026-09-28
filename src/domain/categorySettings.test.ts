import { describe, expect, it } from 'vitest';
import { CategorySetting, Transaction, UserSettings } from '@/types';
import { testSettings, tx } from '@/test/fixtures';
import { createTransactionRules } from '@/domain/transactionRules';
import { calculateMonthlyData } from '@/domain/calculations';
import { calculateAnnualSummaries } from '@/domain/annualSummary';
import {
  UsageCheck,
  activeCategories,
  applyCategoryEdit,
  editableCategory,
  removeCategory,
  restoreCategory,
} from '@/domain/categorySettings';

const usage = (transactions: Transaction[]): UsageCheck => (categoryNames, subNames) =>
  transactions.some(
    (t) =>
      categoryNames.includes(t.category) &&
      (!subNames || (t.subcategory !== undefined && subNames.includes(t.subcategory)))
  );

const find = (list: CategorySetting[], id: string) => list.find((c) => c.id === id)!;

/** 設定画面でカテゴリを編集して保存したのと同じ手順で新しい設定を作る */
const editCategory = (
  settings: UserSettings,
  id: string,
  change: (c: CategorySetting) => CategorySetting,
  transactions: Transaction[]
): UserSettings => {
  const previous = find(settings.categories, id);
  const edited = change(editableCategory(previous));
  const saved = applyCategoryEdit(previous, edited, usage(transactions));
  return {
    ...settings,
    categories: settings.categories.map((c) => (c.id === id ? saved : c)),
  };
};

const transactions = [
  tx('2026-03-01', 'expense', 100_000, '固定費', { subcategory: '積立NISA' }),
  tx('2026-03-02', 'expense', 80_000, '固定費', { subcategory: '家賃' }),
  tx('2026-03-03', 'expense', 50_000, '投資'),
  tx('2026-03-04', 'expense', 3_000, '食費'),
  tx('2026-03-25', 'income', 300_000, '給与', { subcategory: '給料' }),
];

const monthOf = (settings: UserSettings) =>
  calculateMonthlyData(transactions, createTransactionRules(settings)).find(
    (m) => m.month === '2026-03'
  )!;

describe('カテゴリの改名で過去の集計が変わらない（#97）', () => {
  const before = monthOf(testSettings);

  it('役割の無いカテゴリを改名しても、サブカテゴリの役割は旧名の取引に効く', () => {
    const renamed = editCategory(testSettings, 'fixed', (c) => ({ ...c, name: '毎月の費用' }), transactions);
    expect(find(renamed.categories, 'fixed').aliases).toEqual(['固定費']);
    expect(monthOf(renamed)).toEqual(before);
  });

  it('役割付きカテゴリの改名', () => {
    const renamed = editCategory(testSettings, 'invest', (c) => ({ ...c, name: '証券口座' }), transactions);
    const rules = createTransactionRules(renamed);
    expect(rules.isInvestment(transactions[2])).toBe(true);
    expect(monthOf(renamed)).toEqual(before);
  });

  it('給与カテゴリ・サブカテゴリの改名でも給与集計が変わらない', () => {
    const renamed = editCategory(
      testSettings,
      'salary',
      (c) => ({
        ...c,
        name: '本業',
        subcategories: c.subcategories.map((s) => (s.id === 'pay' ? { ...s, name: '月給' } : s)),
      }),
      transactions
    );
    const [summary] = calculateAnnualSummaries(transactions, createTransactionRules(renamed));
    expect(summary.salaryIncome).toBe(300_000);
  });

  it('サブカテゴリの改名', () => {
    const renamed = editCategory(
      testSettings,
      'fixed',
      (c) => ({
        ...c,
        subcategories: c.subcategories.map((s) => (s.id === 'nisa' ? { ...s, name: 'つみたて投資枠' } : s)),
      }),
      transactions
    );
    const nisa = find(renamed.categories, 'fixed').subcategories.find((s) => s.id === 'nisa')!;
    expect(nisa.aliases).toEqual(['積立NISA']);
    expect(monthOf(renamed)).toEqual(before);
  });

  it('改名を重ねても最初の名前の取引が効き、元の名前に戻すと以前の名前から外れる', () => {
    let settings = editCategory(testSettings, 'fixed', (c) => ({ ...c, name: 'A' }), transactions);
    settings = editCategory(settings, 'fixed', (c) => ({ ...c, name: 'B' }), transactions);
    expect(find(settings.categories, 'fixed').aliases).toEqual(['固定費', 'A']);
    expect(monthOf(settings)).toEqual(before);
    settings = editCategory(settings, 'fixed', (c) => ({ ...c, name: '固定費' }), transactions);
    expect(find(settings.categories, 'fixed').aliases).toEqual(['A', 'B']);
    expect(monthOf(settings)).toEqual(before);
  });

  it('旧名の取引は今の名前で分類する（円グラフで旧名と新名に分かれない）', () => {
    const renamed = editCategory(testSettings, 'food', (c) => ({ ...c, name: '食料品' }), transactions);
    const rules = createTransactionRules(renamed);
    expect(rules.categoryName(transactions[3])).toBe('食料品');
    expect(rules.chartKey(transactions[3])).toBe('食料品');
    expect(rules.chartKey(transactions[0])).toBe('積立NISA');
  });

  it('以前の名前と同じ名前の別カテゴリがあれば、そちらを優先する', () => {
    const renamed = editCategory(testSettings, 'invest', (c) => ({ ...c, name: '証券口座' }), transactions);
    const withNew: UserSettings = {
      ...renamed,
      categories: [
        ...renamed.categories,
        { id: 'new', name: '投資', type: 'expense', roles: [], color: testSettings.categories[0].color, subcategories: [] },
      ],
    };
    const rules = createTransactionRules(withNew);
    expect(rules.isInvestment(transactions[2])).toBe(false);
    expect(rules.categoryName(transactions[2])).toBe('投資');
  });
});

describe('使用中のカテゴリの削除（#97）', () => {
  it('使われていればアーカイブし、集計は変わらない', () => {
    const before = monthOf(testSettings);
    const invest = find(testSettings.categories, 'invest');
    const categories = removeCategory(testSettings.categories, invest, usage(transactions));
    expect(find(categories, 'invest').archived).toBe(true);
    expect(monthOf({ ...testSettings, categories })).toEqual(before);
    expect(activeCategories(categories).some((c) => c.id === 'invest')).toBe(false);
  });

  it('使われていなければ消す', () => {
    const advance = find(testSettings.categories, 'advance');
    const categories = removeCategory(testSettings.categories, advance, usage(transactions));
    expect(categories.some((c) => c.id === 'advance')).toBe(false);
  });

  it('アーカイブから戻せる', () => {
    const invest = find(testSettings.categories, 'invest');
    const archived = removeCategory(testSettings.categories, invest, usage(transactions));
    const restored = restoreCategory(archived, 'invest');
    expect(find(restored, 'invest')).toEqual(invest);
  });

  it('使用中のサブカテゴリを消すとアーカイブになり、編集画面と入力の選択肢には出ない', () => {
    const before = monthOf(testSettings);
    const settings = editCategory(
      testSettings,
      'fixed',
      (c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.id !== 'nisa') }),
      transactions
    );
    const fixed = find(settings.categories, 'fixed');
    expect(fixed.subcategories.find((s) => s.id === 'nisa')?.archived).toBe(true);
    expect(monthOf(settings)).toEqual(before);
    expect(editableCategory(fixed).subcategories.map((s) => s.name)).toEqual(['家賃']);
    expect(find(activeCategories(settings.categories), 'fixed').subcategories.map((s) => s.name)).toEqual(['家賃']);

    // もう一度編集して保存してもアーカイブは残る
    const again = editCategory(settings, 'fixed', (c) => c, transactions);
    expect(find(again.categories, 'fixed').subcategories.find((s) => s.id === 'nisa')?.archived).toBe(true);
  });

  it('使われていないサブカテゴリは消す', () => {
    const settings = editCategory(
      testSettings,
      'food',
      (c) => ({ ...c, subcategories: [] }),
      transactions
    );
    expect(find(settings.categories, 'food').subcategories).toEqual([]);
  });

  it('アーカイブ済みのサブカテゴリと同じ名前を新しく作ると、そちらに引き継ぐ', () => {
    let settings = editCategory(
      testSettings,
      'fixed',
      (c) => ({ ...c, subcategories: c.subcategories.filter((s) => s.id !== 'nisa') }),
      transactions
    );
    settings = editCategory(
      settings,
      'fixed',
      (c) => ({ ...c, subcategories: [...c.subcategories, { id: 'nisa2', name: '積立NISA', roles: [] }] }),
      transactions
    );
    const subs = find(settings.categories, 'fixed').subcategories;
    expect(subs.map((s) => s.id)).toEqual(['rent', 'nisa2']);
  });
});
