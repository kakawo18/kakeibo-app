/**
 * 型定義ファイル
 * 
 * このファイルは家計簿アプリで使用する全ての型定義を管理します。
 * 
 * 【カテゴリの変更方法】
 * - 支出カテゴリ: EXPENSE_CATEGORIES を編集
 * - 収入カテゴリ: INCOME_CATEGORIES を編集
 * - 支払方法: PAYMENT_METHODS を編集
 * 
 * 【注意】
 * - カテゴリを変更すると、既存データとの整合性に注意が必要
 * - 投資（固定費→投資）は支出計算から除外される特別なカテゴリ
 */

// ============================================================
// 取引データの型定義
// ============================================================

/**
 * 取引データ
 * Firestoreに保存される1件の取引を表す
 */
export interface Transaction {
  id: string;                    // 取引ID（Firestoreの自動生成ID）
  userId: string;                // ユーザーID
  type: 'income' | 'expense';    // 取引種別: 収入 or 支出
  amount: number;                // 金額（円）
  category: string;              // カテゴリ（例: "食費", "給与"）
  subcategory?: string;          // サブカテゴリ（例: "飲み会費", "ボーナス"）
  paymentMethod?: string;        // 支払方法（例: "現金", "三井住友カード"）
  transactionType?: 'normal' | 'card_payment' | 'card_withdrawal';  // 取引タイプ
  affectsExpense?: boolean;      // 支出計算に影響するか
  affectsBalance?: boolean;      // 残高計算に影響するか
  date: Date;                    // 取引日
  description?: string;          // 説明・メモ
  createdAt: Date;               // 作成日時
  updatedAt: Date;               // 更新日時
}

/**
 * 取引テンプレート（現在未使用）
 */
export interface TransactionTemplate {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  paymentMethod?: string;
  description?: string;
  amount?: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsed: Date;
  usageCount: number;
}

/**
 * 定期取引
 * 毎月自動で記録される取引（家賃、投資など）
 */
export interface RecurringTransaction {
  id: string;
  userId: string;
  name: string;              // 表示名（例: "家賃"、"投資（積立NISA）"）
  amount: number;            // 金額（例: 75000）
  category: string;          // カテゴリ（例: "固定費"）
  subcategory?: string;      // サブカテゴリ（例: "家賃"）
  paymentMethod?: string;    // 支払方法（例: "EPOSカード"）
  dayOfMonth: number;        // 実行日（1-31）
  isEnabled: boolean;        // 有効/無効
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// カテゴリ定義
// ============================================================

/**
 * カテゴリの型
 */
export interface Category {
  name: string;              // カテゴリ名
  subcategories?: string[];  // サブカテゴリ一覧
}

/**
 * 支出カテゴリ一覧
 * 
 * 【カテゴリ追加方法】
 * { name: '新カテゴリ名' } を追加
 * 
 * 【サブカテゴリ追加方法】
 * { name: 'カテゴリ名', subcategories: ['サブ1', 'サブ2'] }
 * 
 * 【注意】
 * - 「投資」は支出計算から除外される特別なサブカテゴリ
 */
export const EXPENSE_CATEGORIES: Category[] = [
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

/**
 * 収入カテゴリ一覧
 * 
 * 【年間貯蓄率の計算】
 * 給与カテゴリの全サブカテゴリが年間収入として計算される
 */
export const INCOME_CATEGORIES: Category[] = [
  { name: '給与', subcategories: ['給与', 'ボーナス', '賞与', '配当収入'] },           // 給与関連（貯蓄率計算に使用）
  { name: '立替回収' },                                                             // 立て替え分の回収（収支から除外）
  { name: 'その他' },                                                // その他の収入
];

// ============================================================
// データ構造の型定義
// ============================================================

/**
 * 月別データ
 * 残高推移グラフ、月別比較に使用
 */
export interface MonthlyData {
  month: string;                      // 月（YYYY-MM形式）
  income: number;                     // 収入合計
  expense: number;                    // 支出合計（投資除外）
  balance: number;                    // 実残高
  categories: Record<string, number>; // カテゴリ別支出
}

/**
 * グラフデータ
 * 円グラフの表示に使用
 */
export interface ChartData {
  name: string;       // カテゴリ名
  value: number;      // 金額
  percentage: number; // 割合（%）
  color?: string;     // 表示色
}

// ============================================================
// 支払方法定義
// ============================================================

/**
 * 支払方法一覧
 * 
 * 【追加方法】
 * 配列に新しい支払方法を追加
 * 
 * 【カード還元ポイント】
 * カードを追加した場合、cardRewards.ts にも還元率を追加する必要あり
 */
export const PAYMENT_METHODS = [
  '現金',              // 現金払い
  '三井住友カード',     // 三井住友カード（還元率: 0.5%）
  '三菱UFJカード',      // 三菱UFJカード（還元率: 7%）
  'amazonカード',       // amazonカード（還元率: 1%）
  'EPOSカード',         // EPOSカード（還元率: 0.25%）
  '楽天カード',         // 楽天カード（還元率: 1%）
] as const;