/**
 * サーバーの日付計算を日本時間にする（docs/claude-connector/仕様書.md 7.4）
 *
 * src/domain の月の判定はローカル時刻（getMonth など）で行う。Vercel の関数は UTC で動き、
 * TZ は予約された環境変数でプロジェクトの設定からは変えられないので、ここで代入する。
 * Node は実行中の TZ の代入を反映する（vitest.config.ts も同じ方法を使っている）。
 */
import 'server-only';

process.env.TZ = 'Asia/Tokyo';

/** 日本時間で動いているか。集計の前に確かめ、違えば誤った月で集計しないよう止める */
export const isJapanTime = (): boolean => new Date(2026, 0, 1).getTimezoneOffset() === -540;

export const assertJapanTime = (): void => {
  if (!isJapanTime()) throw new Error('Server timezone is not Asia/Tokyo');
};
