/**
 * フォーム入力の共通スタイル
 *
 * モバイルでは fontSize を 16px 以上にしないと iOS Safari が
 * フォーカス時に画面を自動ズームしてしまうため、16px を確保する。
 * あわせてタップしやすい高さ（48px）を持たせる。
 */
export const getInputStyles = (isMobile: boolean) => ({
  input: {
    fontSize: isMobile ? '16px' : undefined,
    padding: isMobile ? '12px' : undefined,
    minHeight: isMobile ? '48px' : undefined,
  },
  label: {
    fontSize: isMobile ? '14px' : undefined,
    fontWeight: 500,
  },
});
