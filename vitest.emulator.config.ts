import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Firestore エミュレータに対して、保存形式とセキュリティルールを検証するテスト。
// 通常の npm test とは分けている（Java と Firebase CLI が必要なため）。
// 実行: npm run test:emulator
process.env.TZ = 'Asia/Tokyo';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.emulator.test.ts'],
    environment: 'node',
    // エミュレータ上のデータを共有するので、ファイルを並列に走らせない
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
