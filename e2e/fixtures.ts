import { test as base, expect, type Page } from '@playwright/test';

/**
 * E2E テスト共通の準備
 *
 * - 本番の Firebase（*.googleapis.com など）への通信は遮断する。アプリはエミュレータ（127.0.0.1）に
 *   つなぐ設定でビルドしているが、設定の漏れで本番のデータに触れないよう、念のため二重に止める。
 * - テストごとに新しいアカウントを作る。同じエミュレータを並列のテストで共有しても、
 *   データは uid ごとに分かれるので混ざらない。
 */

// ホスト名で判定する。Auth エミュレータは http://127.0.0.1:9199/identitytoolkit.googleapis.com/... のように
// パスに本番のホスト名を含むので、URL 全体で照合するとエミュレータへの通信まで止めてしまう
const PRODUCTION_FIREBASE_HOST = /(^|\.)(googleapis\.com|firebaseio\.com|firebaseapp\.com)$/;
const isProductionFirebase = (url: URL) => PRODUCTION_FIREBASE_HOST.test(url.hostname);

export interface TestAccount {
  email: string;
  password: string;
}

const newAccount = (): TestAccount => ({
  email: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  password: 'e2e-password-123',
});

export const test = base.extend<{ account: TestAccount; isMobile: boolean }>({
  page: async ({ page }, use, testInfo) => {
    await page.route(isProductionFirebase, (route) => route.abort());
    // 失敗したテストだけ、ブラウザのエラーを添付する（データはエミュレータの架空のものだけ）
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus && errors.length > 0) {
      await testInfo.attach('browser-errors', { body: errors.join('\n'), contentType: 'text/plain' });
    }
  },
  account: async ({}, use) => {
    await use(newAccount());
  },
  isMobile: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'mobile');
  },
});

export { expect };

/**
 * ログイン後の画面（ヘッダーのメニュー）が出るまで待つ。
 * ログイン直後は取引と設定を読み込み、端末のキャッシュを用意するまで中身を出さないので、長めに待つ
 */
export const expectSignedIn = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'メニュー' })).toBeVisible({ timeout: 30_000 });
};

/**
 * ログイン画面が操作できるようになるまで待つ。
 * ハイドレーション前に押したボタンは反応しないので、ログインフォームが
 * 表示後にメール欄へフォーカスを移したこと（useEffect が動いたこと）を合図にする
 */
export const waitForLoginForm = async (page: Page) => {
  await expect(page.getByLabel('メールアドレス')).toBeFocused();
};

/** ログイン画面から新規登録する。登録すると新規ユーザー用の既定のカテゴリが作られる */
export const signUp = async (page: Page, account: TestAccount) => {
  await page.goto('/');
  await waitForLoginForm(page);
  await page.getByRole('button', { name: '新規登録' }).click();
  await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible();
  await page.getByLabel('メールアドレス').fill(account.email);
  await page.getByLabel('パスワード').fill(account.password);
  await page.getByRole('button', { name: '登録する' }).click();
  await expectSignedIn(page);
};

/** カテゴリなどのセレクトで選ぶ。モバイルは OS のピッカー（select 要素）、デスクトップは Mantine の Select */
export const chooseOption = async (page: Page, label: RegExp, option: string, isMobile: boolean) => {
  const dialog = page.getByRole('dialog');
  if (isMobile) {
    await dialog.getByLabel(label).selectOption({ label: option });
    return;
  }
  await dialog.getByLabel(label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};
