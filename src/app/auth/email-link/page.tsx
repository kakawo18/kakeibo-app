/**
 * 確認メールのリンクを開いたときの画面（新規登録・パスワードの再設定。#164 / #165）
 *
 * タブ（(tabs) グループ）の外に置き、ヘッダーやタブバーは出さない。
 * リンクの URL は src/features/auth/emailLink.ts の EMAIL_LINK_PATH と揃える。
 */
import type { Metadata } from 'next';
import { EmailLinkCompletion } from '@/features/auth';

export const metadata: Metadata = {
  title: 'メールアドレスの確認 | 家計簿',
  robots: { index: false, follow: false },
};

export default function EmailLinkPage() {
  return <EmailLinkCompletion />;
}
