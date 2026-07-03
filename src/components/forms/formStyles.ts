/**
 * フォーム入力の共通スタイル
 *
 * モバイルでは fontSize を 16px 以上にしないと iOS Safari が
 * フォーカス時に画面を自動ズームしてしまうため、16px を確保する。
 * あわせてタップしやすい高さ（48px）を持たせる。
 *
 * 注意: 未使用でも undefined 値のキーを含めると、スタイルを受け取る側の
 * 「キー存在」チェック（react-textarea-autosize 等）に引っかかるため、
 * モバイル時のみキーを追加する。
 */
export const getInputStyles = (isMobile: boolean) => ({
  input: isMobile
    ? { fontSize: '16px', padding: '12px', minHeight: '48px' }
    : {},
  label: {
    fontSize: isMobile ? '14px' : undefined,
    fontWeight: 500,
  },
});

/**
 * autosize な Textarea 用のスタイル
 *
 * react-textarea-autosize は style に minHeight / maxHeight キーが
 * 存在するだけで（値が undefined でも）devビルドで例外を投げるため、
 * 高さ指定は含めない。高さは minRows / maxRows で制御する。
 */
export const getTextareaStyles = (isMobile: boolean) => ({
  input: isMobile ? { fontSize: '16px' } : {},
  label: {
    fontSize: isMobile ? '14px' : undefined,
    fontWeight: 500,
  },
});
