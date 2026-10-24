/**
 * テスト用の架空データ
 *
 * 本番の家計データは使わない。役割（CategoryRole）ごとに1つずつカテゴリを用意し、
 * 集計ルールの各分岐を通せるようにしている。
 */
import { Transaction, UserSettings } from '@/types';
import { createTransactionRules } from '@/domain/transactionRules';
import { NEUTRAL_COLOR } from '@/config/colorPalette';

const color = NEUTRAL_COLOR;

export const testSettings: UserSettings = {
  schemaVersion: 1,
  monthlyBudget: 100_000,
  categories: [
    { id: 'food', name: '食費', type: 'expense', roles: [], color, subcategories: [
      { id: 'food-out', name: '外食', roles: [] },
    ] },
    { id: 'fixed', name: '固定費', type: 'expense', roles: [], color, subcategories: [
      { id: 'rent', name: '家賃', roles: ['exclude_from_pace'] },
      // サブカテゴリにだけ役割を付けるケース
      { id: 'nisa', name: '積立NISA', roles: ['investment'] },
    ] },
    { id: 'invest', name: '投資', type: 'expense', roles: ['investment'], color, subcategories: [] },
    { id: 'advance', name: '立替', type: 'expense', roles: ['advance_payment'], color, subcategories: [] },
    { id: 'salary', name: '給与', type: 'income', roles: ['salary_income'], color, subcategories: [
      { id: 'pay', name: '給料', roles: [] },
      { id: 'bonus', name: '賞与', roles: [] },
    ] },
    { id: 'other-income', name: 'その他', type: 'income', roles: [], color, subcategories: [
      { id: 'dividend', name: '配当収入', roles: [] },
    ] },
    { id: 'repay', name: '立替回収', type: 'income', roles: ['advance_repayment'], color, subcategories: [] },
  ],
  paymentMethods: [
    { id: 'cash', name: '現金', isCash: true, rewardRate: 0, color: NEUTRAL_COLOR.light },
    { id: 'card', name: '楽天カード', isCash: false, rewardRate: 0.01, color: NEUTRAL_COLOR.light },
    { id: 'card0', name: '還元なしカード', isCash: false, rewardRate: 0, color: NEUTRAL_COLOR.light },
  ],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export const testRules = createTransactionRules(testSettings);

let sequence = 0;

/** 取引を1件作る。日付は 'YYYY-MM-DD'（ローカル時刻の正午にして月境界のずれを避ける） */
export const tx = (
  date: string,
  type: Transaction['type'],
  amount: number,
  category: string,
  extra: Partial<Transaction> = {}
): Transaction => {
  const [y, m, d] = date.split('-').map(Number);
  sequence += 1;
  return {
    id: `t${sequence}`,
    userId: 'test-user',
    type,
    amount,
    category,
    date: new Date(y, m - 1, d, 12),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    affectsExpense: true,
    transactionType: 'normal',
    ...extra,
  };
};
