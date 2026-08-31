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
  | 'salary_income'      // 給与収入: 貯蓄率の分母・額面推定の対象
  | 'investment'         // 投資: 支出から除外し年間投資額に集計
  | 'advance_payment'    // 立替金: 支出から除外
  | 'advance_repayment'  // 立替回収: 収入から除外
  | 'exclude_from_pace'; // 支出ペースチャートから除外(家賃など毎月の固定額)

/** 役割の日本語ラベル(設定UIで使用) */
export const CATEGORY_ROLE_LABELS: Record<CategoryRole, string> = {
  salary_income: '給与収入',
  investment: '投資',
  advance_payment: '立替金',
  advance_repayment: '立替回収',
  exclude_from_pace: '支出ペース除外',
};

/**
 * 役割の説明(設定UIで使用)
 *
 * 「この役割を付けると集計がどう変わるか」を書く。
 * 役割を足したらここにも必ず1行足すこと。設定画面はこの内容をそのまま表示する。
 */
export const CATEGORY_ROLE_DESCRIPTIONS: Record<CategoryRole, string> = {
  salary_income:
    '貯蓄率の分母になります。年収の額面を推定する対象にもなるため、給与と賞与だけに付けてください（配当などは付けない）',
  investment:
    '支出から外し、年間投資額として集計します。証券口座へ入れたお金に付けてください',
  advance_payment: '支出から外します。他人の分を立て替えて払ったときに使います',
  advance_repayment: '収入から外します。立て替えた分が返ってきたときに使います',
  exclude_from_pace:
    '支出ペースのグラフから外します。家賃のように毎月同じ額が出ていくものに付けると、日々の使いすぎが見やすくなります',
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
