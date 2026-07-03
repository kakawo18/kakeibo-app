/**
 * ユーザー設定の型定義
 *
 * カテゴリ・支払方法・月間予算などユーザーごとの設定は
 * Firestore の users/{uid}/settings/app に単一ドキュメントとして保存される。
 * 配列の並び順がそのまま画面上の表示順になる。
 *
 * 【役割(CategoryRole)について】
 * 集計ロジックはカテゴリ名の文字列一致ではなく、カテゴリ/サブカテゴリに
 * 付与された役割で判定する。これによりユーザーがカテゴリを自由に
 * 追加・変更しても貯蓄率・投資額などの計算が壊れない。
 */

/** カテゴリ/サブカテゴリに付与できる役割 */
export type CategoryRole =
  | 'salary_income'      // 給与収入: 貯蓄率の分母・年間収入に集計
  | 'investment'         // 投資: 支出から除外し年間投資額に集計
  | 'advance_payment'    // 立替金: 支出から除外
  | 'advance_repayment'  // 立替回収: 収入から除外
  | 'card_withdrawal'    // カード引き落とし: 支出集計に含めず残高のみ減らす
  | 'exclude_from_pace'; // 支出ペースチャートから除外(家賃など毎月の固定額)

/** 役割の日本語ラベル(設定UIで使用) */
export const CATEGORY_ROLE_LABELS: Record<CategoryRole, string> = {
  salary_income: '給与収入',
  investment: '投資',
  advance_payment: '立替金',
  advance_repayment: '立替回収',
  card_withdrawal: 'カード引き落とし',
  exclude_from_pace: '支出ペース除外',
};

/** ライト/ダーク両テーマの色ペア */
export interface CategoryColor {
  light: string;
  dark: string;
}

/** サブカテゴリ設定 */
export interface SubcategorySetting {
  id: string;                // 安定ID(crypto.randomUUID)。名前変更に耐える
  name: string;              // 取引データはこの文字列を保持する(表示名=保存名)
  roles: CategoryRole[];
  color?: CategoryColor;     // 円グラフはサブカテゴリ優先で集計するため個別色を持てる
}

/** カテゴリ設定 */
export interface CategorySetting {
  id: string;
  name: string;
  type: 'expense' | 'income';
  roles: CategoryRole[];
  color: CategoryColor;
  subcategories: SubcategorySetting[];
}

/** 支払方法設定 */
export interface PaymentMethodSetting {
  id: string;
  name: string;
  isCash: boolean;           // true=現金扱い(カード支払い判定に使用)
  rewardRate: number;        // 還元率(0.01 = 1%)。現金は0
  color: string;             // カード還元表示用の単色
}

/** ユーザー設定(users/{uid}/settings/app) */
export interface UserSettings {
  schemaVersion: 1;
  monthlyBudget: number;
  categories: CategorySetting[];      // expense/income混在、typeで区別。配列順=表示順
  paymentMethods: PaymentMethodSetting[];
  createdAt: Date;
  updatedAt: Date;
}
