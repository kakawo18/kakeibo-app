import { defineConfig, devices } from '@playwright/test';

/**
 * E2E テスト（画面を実際に操作して主要な流れを確かめる）
 *
 * 実行: npm run test:e2e
 * Firebase CLI が Auth と Firestore のエミュレータ（firebase.e2e.json のポート）を起動し、
 * その中で playwright test を走らせる。
 * アプリはエミュレータにつなぐ設定で本番ビルドし、手元の開発サーバー（3000）とは別のポートで起動する。
 * 本番の Firebase にはつながない（e2e/fixtures.ts で本番の接続先への通信も遮断している）。
 */
const PORT = 3100;

/**
 * エミュレータ用の Firebase 設定。process.env の値は .env.local より優先されるので、
 * 手元に本番の .env.local があっても、ここで渡した値でビルドされる。
 * App Check のキーは空にして無効にする（エミュレータには reCAPTCHA の検証が無い）。
 */
const emulatorEnv = {
  NEXT_PUBLIC_FIREBASE_EMULATOR: '1',
  // firebase.e2e.json のポート。開発用のエミュレータ（firebase.json）とぶつからないよう分けている
  NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_PORT: '9199',
  NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_PORT: '8180',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-kakeibo.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-kakeibo',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-kakeibo.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app-id',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: '',
};

export default defineConfig({
  testDir: './e2e',
  // 各テストが自分専用のアカウントを作るので、並列に走らせてもデータは混ざらない
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // 本番ビルドは .next に出力するので、手元の npm run build の成果物は上書きされる
    // （next dev は .next/dev を使うので、開発サーバーとはぶつからない）
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // 手元で動いている別のサーバー（本番の Firebase につながっているかもしれない）を使い回さない
    reuseExistingServer: false,
    timeout: 300_000,
    env: emulatorEnv,
  },
});
