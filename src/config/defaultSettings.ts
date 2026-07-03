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
} from '@/types';
import {
  CATEGORY_PALETTE,
  NEUTRAL_COLOR,
  LEGACY_ENTITY_COLORS,
} from '@/config/colorPalette';

/**
 * v2.0 以前に types/index.ts にハードコードされていたカテゴリ定義(レガシーシード用)。
 * 既存の取引データはこれらのカテゴリ名文字列を保持しているため、変更禁止。
 */
const LEGACY_EXPENSE_CATEGORIES: Category[] = [
  { name: '食費' },                                                              // 食事、外食
  { name: '交際費', subcategories: ['飲み会費'] },                                 // 交際費
  { name: '固定費', subcategories: ['家賃', '投資', '通信費', '電気代', 'ガス代', '水道代'] },  // 固定費（投資は支出から除外）
  { name: '日用品' },                                                            // 日用品
  { name: '交通費' },                                                            // 交通費
  { name: '趣味代' },                                                            // 趣味・娯楽
  { name: '旅行代' },                                                            // 旅行
  { name: '医療費' },                                                            // 医療費
  { name: 'その他' },                                                            // その他
  { name: '立替金' },                                                              // 立て替え払い（収支から除外）
];

const LEGACY_INCOME_CATEGORIES: Category[] = [
  { name: '給与', subcategories: ['給与', 'ボーナス', '賞与', '配当収入'] },           // 給与関連（貯蓄率計算に使用）
  { name: '立替回収' },                                                             // 立て替え分の回収（収支から除外）
  { name: 'その他' },                                                // その他の収入
];

const LEGACY_PAYMENT_METHODS = [
  '現金',              // 現金払い
  '三井住友カード',     // 三井住友カード（還元率: 0.5%）
  '三菱UFJカード',      // 三菱UFJカード（還元率: 7%）
  'amazonカード',       // amazonカード（還元率: 1%）
  'EPOSカード',         // EPOSカード（還元率: 0.25%）
  '楽天カード',         // 楽天カード（還元率: 1%）
] as const;

/** 旧 cardRewards.ts にハードコードされていたカード別還元率(レガシーシード用) */
const LEGACY_CARD_REWARD_RATES: Record<string, number> = {
  '楽天カード': 0.01,        // 1%
  '三菱UFJカード': 0.07,     // 7%
  'EPOSカード': 0.0025,      // 0.25%
  'amazonカード': 0.01,      // 1%
  '三井住友カード': 0.005,   // 0.5%
};

/** 旧 cardRewards.ts にハードコードされていたカード色(レガシーシード用) */
const LEGACY_CARD_COLORS: Record<string, string> = {
  '楽天カード': '#bf0000',
  '三菱UFJカード': '#dc143c',
  'EPOSカード': '#ff6b35',
  'amazonカード': '#ff9900',
  '三井住友カード': '#009639',
};

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
    ...LEGACY_EXPENSE_CATEGORIES.map((c) => toLegacyCategory(c, 'expense')),
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
    ...LEGACY_INCOME_CATEGORIES.map((c) => toLegacyCategory(c, 'income')),
  ];

  const paymentMethods: PaymentMethodSetting[] = LEGACY_PAYMENT_METHODS.map((name) => ({
    id: newId(),
    name,
    isCash: name === '現金',
    rewardRate: LEGACY_CARD_REWARD_RATES[name] ?? 0,
    color: LEGACY_CARD_COLORS[name] ?? '#8b919e',
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
