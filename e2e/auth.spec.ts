import { test, expect, expectSignedIn, signUp, waitForLoginForm } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * ログアウトする。アプリは端末の Firestore のキャッシュを消してからページを読み込み直すので（#126）、
 * 読み込み直しが終わるのを待ってから次の入力をする。待たないと、入力した内容が読み込み直しで消える
 */
const logout = async (page: Page) => {
  await page.getByRole('button', { name: 'メニュー' }).click();
  const reloaded = page.waitForEvent('load');
  await page.getByRole('menuitem', { name: 'ログアウト' }).click();
  await reloaded;
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  await waitForLoginForm(page);
};

test('新規登録して、ログアウトし、もう一度ログインできる', async ({ page, account }) => {
  await signUp(page, account);
  await logout(page);

  await page.getByLabel('メールアドレス').fill(account.email);
  await page.getByLabel('パスワード').fill(account.password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expectSignedIn(page);
});

test('パスワードが違うとログインできない', async ({ page, account }) => {
  await signUp(page, account);
  await logout(page);

  await page.getByLabel('メールアドレス').fill(account.email);
  await page.getByLabel('パスワード').fill('wrong-password-123');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();

  await expect(page.getByText('メールアドレスまたはパスワードが正しくありません。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'メニュー' })).toHaveCount(0);
});
