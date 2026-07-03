/**
 * ユーザー設定のデフォルト値
 *
 * - buildGenericDefaultSettings: 新規ユーザー用の汎用プリセット
 * - buildLegacySettings: 既存ユーザー(取引データあり・設定docなし)用。
 *   旧ハードコード定数からプログラム的に組み立てる。
 *   ※カテゴリ名が1文字でも旧定数とズレると既存取引が色・役割を失うため、
 *     手書き転記は厳禁。必ず定数から生成する。
 */
import {
  UserSettings,
  CategorySetting,
  SubcategorySetting,
  PaymentMethodSetting,
  CategoryRole,
  CategoryColor,
  Category,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from '@/types';
import { CARD_REWARD_RATES, CARD_COLORS, CardType } from '@/utils/cardRewards';
import {
  CATEGORY_PALETTE,
  NEUTRAL_COLOR,
  LEGACY_ENTITY_COLORS,
} from '@/config/colorPalette';

const DEFAULT_MONTHLY_BUDGET = 100000;

const newId = (): string => crypto.randomUUID();

// ============================================================
// 汎用デフォルト(新規ユーザー用)
// ============================================================

const GENERIC_EXPENSE_NAMES = [
  '食費',
  '日用品',
  '交通費',
  '交際費',
  '趣味・娯楽',
  '医療費',
  '住居費',
  '水道光熱費',
  '通信費',
  'その他',
];

export const buildGenericDefaultSettings = (): UserSettings => {
  const now = new Date();

  const expenseCategories: CategorySetting[] = GENERIC_EXPENSE_NAMES.map(
    (name, index) => ({
      id: newId(),
      name,
      type: 'expense',
      roles: [],
      color:
        name === 'その他'
          ? NEUTRAL_COLOR
          : CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
      subcategories: [],
    })
  );

  const incomeCategories: CategorySetting[] = [
    {
      id: newId(),
      name: '給与',
      type: 'income',
      roles: ['salary_income'],
      color: { light: '#0f9b6c', dark: '#1db584' },
      subcategories: [],
    },
    {
      id: newId(),
      name: 'その他',
      type: 'income',
      roles: [],
      color: NEUTRAL_COLOR,
      subcategories: [],
    },
  ];

  const paymentMethods: PaymentMethodSetting[] = [
    {
      id: newId(),
      name: '現金',
      isCash: true,
      rewardRate: 0,
      color: '#8b919e',
    },
  ];

  return {
    schemaVersion: 1,
    monthlyBudget: DEFAULT_MONTHLY_BUDGET,
    categories: [...expenseCategories, ...incomeCategories],
    paymentMethods,
    createdAt: now,
    updatedAt: now,
  };
};

// ============================================================
// レガシー設定(既存ユーザーへのシード用)
// ============================================================

/** 旧集計ロジックがカテゴリ名で判定していた役割の対応表 */
const LEGACY_CATEGORY_ROLES: Record<string, CategoryRole[]> = {
  '給与': ['salary_income'],
  '立替金': ['advance_payment'],
  '立替回収': ['advance_repayment'],
};

/** 旧集計ロジックが「カテゴリ>サブカテゴリ」で判定していた役割の対応表 */
const LEGACY_SUBCATEGORY_ROLES: Record<string, CategoryRole[]> = {
  '固定費>投資': ['investment'],
  '固定費>家賃': ['exclude_from_pace'],
};

const legacyColor = (name: string, fallback: CategoryColor): CategoryColor =>
  LEGACY_ENTITY_COLORS[name] ?? fallback;

const toLegacyCategory = (
  category: Category,
  type: 'expense' | 'income'
): CategorySetting => {
  const color = legacyColor(category.name, NEUTRAL_COLOR);
  const subcategories: SubcategorySetting[] = (category.subcategories ?? []).map(
    (subName): SubcategorySetting => {
      const subColor = legacyColor(subName, color);
      return {
        id: newId(),
        name: subName,
        roles: LEGACY_SUBCATEGORY_ROLES[`${category.name}>${subName}`] ?? [],
        // カテゴリと同色のサブは個別色を持たせない(カテゴリ色にフォールバック)
        ...(subColor.light !== color.light ? { color: subColor } : {}),
      };
    }
  );

  return {
    id: newId(),
    name: category.name,
    type,
    roles: LEGACY_CATEGORY_ROLES[category.name] ?? [],
    color,
    subcategories,
  };
};

export const buildLegacySettings = (): UserSettings => {
  const now = new Date();

  const categories: CategorySetting[] = [
    ...EXPENSE_CATEGORIES.map((c) => toLegacyCategory(c, 'expense')),
    // 「カード引き落とし」は旧フォームの選択肢には無いが、
    // transactionRules の判定・CSVインポート経由で取引データに存在しうる
    {
      id: newId(),
      name: 'カード引き落とし',
      type: 'expense',
      roles: ['card_withdrawal'],
      color: NEUTRAL_COLOR,
      subcategories: [],
    },
    ...INCOME_CATEGORIES.map((c) => toLegacyCategory(c, 'income')),
  ];

  const paymentMethods: PaymentMethodSetting[] = PAYMENT_METHODS.map((name) => ({
    id: newId(),
    name,
    isCash: name === '現金',
    rewardRate: CARD_REWARD_RATES[name as CardType] ?? 0,
    color: CARD_COLORS[name as keyof typeof CARD_COLORS] ?? '#8b919e',
  }));

  return {
    schemaVersion: 1,
    monthlyBudget: DEFAULT_MONTHLY_BUDGET,
    categories,
    paymentMethods,
    createdAt: now,
    updatedAt: now,
  };
};
