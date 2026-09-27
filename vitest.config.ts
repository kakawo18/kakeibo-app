import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 日付の月判定（getMonth / formatMonthLocal）はローカルタイムゾーンに依存する。
// 実行環境によって結果が変わらないよう、利用者と同じ日本時間に固定する。
// テストのワーカーは設定の読み込み後に起動するので、ここで設定すれば全テストに効く。
process.env.TZ = 'Asia/Tokyo';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
