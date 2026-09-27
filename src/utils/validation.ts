/**
 * 入力値の検証（#117）
 *
 * 取引フォーム・定期取引・設定・CSV の各経路で同じ基準を使う。
 * 基準は firestore.rules と揃える。画面で作れた値がサーバーで拒否される、
 * という食い違いを起こさないため。
 */

/** カテゴリ・サブカテゴリ・支払方法の名前の上限（firestore.rules の category.size() <= 50） */
export const MAX_NAME_LENGTH = 50;

/** 1件あたりの金額の上限（桁の打ち間違いの検出用） */
export const MAX_AMOUNT = 1_000_000_000;

/** 名前の検証。問題が無ければ null、あればエラーメッセージ */
export const validateName = (name: string, label: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return `${label}を入力してください`;
  if (trimmed.length > MAX_NAME_LENGTH) return `${label}は${MAX_NAME_LENGTH}文字以内にしてください`;
  return null;
};

/**
 * 金額の検証。保存時は小数点以下を切り捨てるので、切り捨てた値で判定する。
 * 数値にならない値・無限大・1円未満・上限超えはエラー
 */
export const validateAmount = (value: unknown): string | null => {
  if (value === '' || value === null || value === undefined) {
    return '1円以上の金額を入力してください';
  }
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 1) return '1円以上の金額を入力してください';
  if (amount > MAX_AMOUNT) return '金額が大きすぎます（10億円まで）';
  return null;
};
