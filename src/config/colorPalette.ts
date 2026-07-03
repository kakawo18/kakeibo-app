/**
 * カテゴリ用カラーパレット
 *
 * CVD(色覚多様性)検証済みのパレット。ライト面(白)/ダーク面(#1d1e22)
 * それぞれで検証済みのステップを使用する(旧 calculations.ts の
 * CATEGORY_COLORS から抽出)。
 *
 * 設定UIではこのパレットからのスウォッチ選択のみを許可し、
 * 自由なHEX入力は提供しない(ダーク面での可読性を壊せないようにするため)。
 */
import { CategoryColor } from '@/types/settings';

/** カテゴリに割り当て可能なシリーズ色 */
export const CATEGORY_PALETTE: CategoryColor[] = [
  { light: '#e34948', dark: '#e66767' }, // レッド
  { light: '#e87ba4', dark: '#d55181' }, // ピンク
  { light: '#eb6834', dark: '#d95926' }, // オレンジ
  { light: '#eda100', dark: '#c98500' }, // アンバー
  { light: '#0f9b6c', dark: '#1db584' }, // グリーン
  { light: '#1baf7a', dark: '#199e70' }, // ティール
  { light: '#008300', dark: '#3da23d' }, // ダークグリーン
  { light: '#2a78d6', dark: '#3987e5' }, // ブルー
  { light: '#4a3aa7', dark: '#9085e9' }, // パープル
];

/** ニュートラル(カード・その他などシリーズ色を消費させたくない項目用) */
export const NEUTRAL_COLOR: CategoryColor = { light: '#8b919e', dark: '#82868f' };

/** 弱いニュートラル(立替金・立替回収など収支から除外される項目用) */
export const NEUTRAL_MUTED_COLOR: CategoryColor = { light: '#adb2bc', dark: '#6d7178' };

/** 設定UIのスウォッチに表示する全色(シリーズ色+ニュートラル2種) */
export const SWATCH_COLORS: CategoryColor[] = [
  ...CATEGORY_PALETTE,
  NEUTRAL_COLOR,
  NEUTRAL_MUTED_COLOR,
];

/** 支払方法(カード)用の単色スウォッチ */
export const PAYMENT_METHOD_SWATCHES: string[] = [
  '#bf0000', // 楽天レッド系
  '#dc143c', // クリムゾン
  '#ff6b35', // オレンジ
  '#ff9900', // アンバー
  '#009639', // グリーン
  '#2a78d6', // ブルー
  '#4a3aa7', // パープル
  '#8b919e', // ニュートラル
];

/**
 * 使用回数が最も少ないパレット色を返す(新規カテゴリの自動割当用)
 */
export const pickLeastUsedColor = (usedColors: CategoryColor[]): CategoryColor => {
  const counts = CATEGORY_PALETTE.map(
    (palette) => usedColors.filter((used) => used.light === palette.light).length
  );
  const minIndex = counts.indexOf(Math.min(...counts));
  return CATEGORY_PALETTE[minIndex];
};

/**
 * 旧 CATEGORY_COLORS(calculations.ts)のエンティティ固定割り当て。
 * 既存ユーザーへのレガシー設定シードの色ソースとして使用する。
 */
export const LEGACY_ENTITY_COLORS: Record<string, CategoryColor> = {
  // 収入カテゴリ
  '給与': { light: '#0f9b6c', dark: '#1db584' },
  'ボーナス': { light: '#1baf7a', dark: '#199e70' },
  '賞与': { light: '#1baf7a', dark: '#199e70' },
  '配当収入': { light: '#008300', dark: '#3da23d' },
  'その他': NEUTRAL_COLOR,

  // 支出カテゴリ(エンティティ固定割り当て)
  '食費': { light: '#e34948', dark: '#e66767' },
  '交際費': { light: '#e87ba4', dark: '#d55181' },
  '飲み会費': { light: '#e87ba4', dark: '#d55181' },
  '固定費': { light: '#2a78d6', dark: '#3987e5' },
  '家賃': { light: '#2a78d6', dark: '#3987e5' },
  '通信費': { light: '#4a3aa7', dark: '#9085e9' },
  '電気代': { light: '#eda100', dark: '#c98500' },
  'ガス代': { light: '#eb6834', dark: '#d95926' },
  '水道代': { light: '#1baf7a', dark: '#199e70' },
  '光熱費': { light: '#eda100', dark: '#c98500' },
  '日用品': { light: '#1baf7a', dark: '#199e70' },
  '交通費': { light: '#eda100', dark: '#c98500' },
  '趣味代': { light: '#4a3aa7', dark: '#9085e9' },
  '旅行代': { light: '#eb6834', dark: '#d95926' },
  '医療費': { light: '#008300', dark: '#3da23d' },
  '投資': { light: '#008300', dark: '#3da23d' },

  // カード・立替はニュートラル(シリーズ色を消費しない)
  '三井住友カード': NEUTRAL_COLOR,
  '三菱UFJカード': NEUTRAL_COLOR,
  'amazonカード': NEUTRAL_COLOR,
  'EPOSカード': NEUTRAL_COLOR,
  '楽天カード': NEUTRAL_COLOR,
  'カード引き落とし': NEUTRAL_COLOR,
  '立替金': NEUTRAL_MUTED_COLOR,
  '立替回収': NEUTRAL_MUTED_COLOR,
};
