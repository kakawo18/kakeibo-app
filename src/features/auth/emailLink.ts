/**
 * メールのリンクで本人を確かめる手続きの共通部分（#164 / #165）
 *
 * 新規登録とパスワードの再設定は、どちらも「メールアドレスにリンクを送る → リンクを開いて
 * パスワードを設定する」の同じ手順にしている。
 * - 他人のメールアドレスで登録できない（リンクはそのアドレスにしか届かない）
 * - 登録済みかどうかで画面の応答が変わらない（どちらも「メールを送りました」）。
 *   リンクの送信（sendSignInLinkToEmail）は登録の有無を確かめないので、通信の応答でも区別できない
 */
import { ActionCodeSettings } from 'firebase/auth';

/** リンクを開いたときに戻る画面のパス（src/app/auth/email-link/page.tsx） */
export const EMAIL_LINK_PATH = '/auth/email-link';

/** 新規登録・再設定で要求するパスワードの最小文字数（Firebase の既定は6文字） */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * リンクを送った端末で、どのアドレスに送ったかを覚えておくキー。
 * 同じ端末・ブラウザでリンクを開けば、アドレスを入れ直さずに済む
 */
const EMAIL_STORAGE_KEY = 'kakeibo:emailForSignIn';

export const emailLinkSettings = (origin: string): ActionCodeSettings => ({
  url: `${origin}${EMAIL_LINK_PATH}`,
  handleCodeInApp: true,
});

// 保存できない環境（プライベートブラウズなど）では、リンクを開いたときにアドレスを入れてもらう
export const rememberEmailForSignIn = (email: string): void => {
  try {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  } catch {
    // 覚えられなくても手続きは続けられる
  }
};

export const recallEmailForSignIn = (): string | null => {
  try {
    return window.localStorage.getItem(EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const forgetEmailForSignIn = (): void => {
  try {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  } catch {
    // 消せなくても次の送信で上書きされる
  }
};
